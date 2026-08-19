#!/usr/bin/env nbb
;; verify_sources.cljs — re-fetch every endpoint recorded in data/sources.json
;; and check it still answers with the status the catalogue claims.
;;
;; The catalogue is a provenance record: it asserts "on verifiedAt, this URL
;; returned this status". That assertion decays silently — government sites
;; move, hosts lose a label, an API version is retired — and a decayed
;; catalogue looks exactly like a fresh one. This script is what makes the
;; difference observable.
;;
;; Exit codes are three, not two, because "every endpoint is healthy" and
;; "I could not check" must not print the same thing:
;;
;;   0  every recorded-reachable URL returned its expected status
;;   1  at least one returned something else — a real regression
;;   2  the question could not be answered (catalogue missing/unreadable,
;;      zero URLs to check, or no HTTP response reached us at all)
;;
;; Exit 2 exists because a verifier that cannot run must not be mistaken for
;; a verifier that ran clean. Likewise the SCANNED line below is an evidence
;; floor: a run that checked nothing is never reported as a pass.
;;
;;   nbb tools/verify_sources.cljs [<repo-dir>] [--timeout-ms N]

(ns verify-sources
  (:require [clojure.string :as str]
            [promesa.core :as p]
            ["fs" :as fs]
            ["path" :as path]
            ["process" :as process]))

;; node argv is [node, nbb, script, ...user args] under nbb.
(def argv (vec (drop 3 (js->clj (.-argv process)))))

(defn- flag-val [name default]
  (if-let [i (first (keep-indexed #(when (= %2 name) %1) argv))]
    (or (get argv (inc i)) default)
    default))

;; The directory is the first positional argument, and it is read positionally
;; on purpose: gates in this fleet are invoked as `<script> <dir> [--flags]`.
;; Flag VALUES are skipped explicitly — scanning for "the first argument not
;; starting with --" would happily accept a flag's value as the repo path.
(defn- positional [args]
  (loop [a args out []]
    (if-let [x (first a)]
      (if (str/starts-with? x "--")
        (recur (drop 2 a) out)
        (recur (rest a) (conj out x)))
      out)))

(def repo-dir (or (first (positional argv)) "."))

(def timeout-ms (js/parseInt (flag-val "--timeout-ms" "30000")))
(def catalog-path (path/join repo-dir "data" "sources.json"))

(defn- die! [code & msg]
  (binding [*print-fn* *print-err-fn*] (apply println msg))
  (js/process.exit code))

(when-not (fs/existsSync catalog-path)
  (die! 2 (str "CANNOT-ANSWER\tno catalogue at " catalog-path
               "\n  This is exit 2, not a pass: nothing was checked.")))

(def catalog
  (try
    (js->clj (js/JSON.parse (fs/readFileSync catalog-path "utf8")) :keywordize-keys true)
    (catch :default e
      (die! 2 (str "CANNOT-ANSWER\tcatalogue is not readable JSON: " (.-message e))))))

;; Structural checks run before the network ones. They need no egress, and a
;; catalogue whose tier mapping points at a collection that does not exist is
;; broken regardless of whether every URL is up — that defect would otherwise
;; hide behind a green run.
(defn- structural-errors [c]
  (let [collection-ids (set (map :collectionId (:caseCollections c)))
        source-ids     (map :sourceId (:sources c))
        dangling       (for [[tier coll] (get-in c [:courtTiers :mapping])
                             :when (not (contains? collection-ids (name coll)))]
                         (str "courtTiers.mapping." (name tier) " -> \"" coll
                              "\" is not a collectionId in caseCollections"))
        dupe-sources   (for [[id n] (frequencies source-ids) :when (> n 1)]
                         (str "duplicate sourceId \"" id "\" (" n " entries)"))
        dupe-colls     (for [[id n] (frequencies (map :collectionId (:caseCollections c))) :when (> n 1)]
                         (str "duplicate collectionId \"" id "\" (" n " entries)"))]
    (concat dangling dupe-sources dupe-colls)))

(when-let [errs (seq (structural-errors catalog))]
  (die! 1 (str "FAIL\tcatalogue is internally inconsistent (" (count errs) "):\n"
               (str/join "\n" (map #(str "  - " %) errs)))))

(defn- targets
  "Every (label, url, expected-status) the catalogue claims is reachable."
  [c]
  (concat
   (for [s (:sources c) :when (get-in s [:verify :url])]
     {:label (str "source/" (:sourceId s))
      :url (get-in s [:verify :url])
      :expect (get-in s [:verify :expectStatus] 200)})
   (for [s (:caseCollections c) :when (get-in s [:verify :url])]
     {:label (str "collection/" (:collectionId s))
      :url (get-in s [:verify :url])
      :expect (get-in s [:verify :expectStatus] 200)})))

(defn- fetch-status
  "Resolve to {:status n} on any HTTP response, or {:error msg} if no response
   arrived. The distinction decides exit 1 vs exit 2, so the transport error
   text is kept rather than collapsed into a boolean."
  [url]
  (-> (js/fetch url
                #js {:redirect "follow"
                     :signal (js/AbortSignal.timeout timeout-ms)
                     :headers #js {"user-agent" "app-hanrei-source-catalog/1.0 (+https://github.com/cloud-itonami/app-hanrei)"}})
      (p/then (fn [r] {:status (.-status r)}))
      (p/catch (fn [e] {:error (or (.-message e) (str e))}))))

(defn- check-seq
  "Sequential on purpose: these are public government hosts and this runs on a
   schedule. Concurrency here would buy seconds and spend goodwill."
  [ts]
  (p/loop [remaining ts acc []]
    (if (empty? remaining)
      acc
      (p/let [t (first remaining)
              res (fetch-status (:url t))]
        (let [ok? (= (:status res) (:expect t))
              row (merge t res {:ok? ok?})]
          (println (str (cond (:error res) "ERROR   "
                              ok?          "OK      "
                              :else        "MISMATCH")
                        "\t" (:label t)
                        "\t" (or (:status res) (str "no-response: " (:error res)))
                        (when-not ok? (str "\texpected " (:expect t)))))
          (p/recur (rest remaining) (conj acc row)))))))

(p/let [ts (targets catalog)
        _  (when (empty? ts)
             (die! 2 (str "CANNOT-ANSWER\tcatalogue lists zero verifiable URLs."
                          "\n  Refusing to report a pass over an empty set.")))
        rows (check-seq ts)]
  (let [n         (count rows)
        responded (count (remove :error rows))
        bad       (remove :ok? rows)]
    ;; Evidence floor. A reader who sees only "no problems" cannot tell a clean
    ;; run from a run that looked at nothing; this line makes n visible always.
    (println (str "SCANNED\t" n "\tresponded\t" responded))
    (doseq [u (:knownUnreachable catalog)]
      (println (str "INFO    \tknown-unreachable\t" (:url u) "\t" (:observed u))))
    (cond
      (zero? responded)
      (die! 2 (str "CANNOT-ANSWER\t" n " URL(s) checked, not one HTTP response arrived."
                   "\n  This looks like no network from here, not a broken catalogue."
                   "\n  Reporting exit 2 rather than a failure or a pass."))

      (seq bad)
      (die! 1 (str "FAIL\t" (count bad) " of " n " endpoint(s) no longer answer as recorded:"
                   "\n" (str/join "\n" (map #(str "  - " (:label %) "\t" (:url %)
                                                  "\t" (or (:status %) (:error %))
                                                  "\texpected " (:expect %))
                                            bad))))

      :else
      (println (str "PASS\tall " n " recorded endpoint(s) answered as the catalogue claims")))))
