# Extraction accuracy acceptance

The 99% target is not yet verified. Unit tests and AI agreement do not establish extraction accuracy.

Run the app with `npm run dev`, then run `node benchmark-runner.mjs benchmarks/manifest.json benchmarks/report.json`. The runner calls the actual visual extraction and independent verification pipeline. It prints aggregate metrics only and returns exit code 2 unless the gate passes.

Add independently checked, held-out cases to the manifest. Each case has `id`, a `file` path relative to the manifest, `mime`, `manuallyChecked: true`, and an `expected` array. Every expected entry contains `role`, `record`, `field`, `value`, and `handwritten`. Annotate all supported fields, including the correct party, property or payment association; do not generate ground truth using the extractor under test. Record names follow the extraction contract: primary for one record of a role in the source, explicit names/identifiers when several are present. Empty expected values mean the source cannot support a value.

Keep personal source files outside version control. Include genuine handwritten English and Telugu notes, photographs with rotations and shadows, scanned deeds, multiple people and instruments, duplicate sources, crossings-out and illegible regions. Use the same frozen corpus for model comparisons without tuning prompts against the held-out answers.

The release gate requires at least 50 manually checked documents, 1,000 expected fields and 100 handwritten fields. Overall, handwriting and critical identifiers each need at least 99% populated-field precision. A separate 95% coverage floor prevents an extractor from passing by returning almost nothing. These are operational acceptance defaults, not measured results. The report includes coverage, median extraction latency and manual edits.

The supplied Word file is a blank template, not extraction ground truth. The supplied reference plan photograph alone is insufficient to establish the accuracy target. Until a representative manually checked corpus is supplied and passes, the report must remain `not-verified`.
