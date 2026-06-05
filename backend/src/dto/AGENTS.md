# backend/src/dto — Request/response DTOs

Data transfer objects: the request and response shapes for the API. These define
the wire contract and the OpenAPI schema.

## Conventions

- Request DTOs implement validation (manually or `#[derive(ValidatedDto)]`) and
  are extracted in handlers as **`ValidatedJson<T>`** — the raw `Json<T>` extractor
  bypasses the validation gate. Enforcement is **opt-out-with-reason** (issue #828):
  CI fails on any request-body DTO that is neither a `ValidatedDto` nor listed in
  `scripts/validated-extractor-exemptions.txt` with a reason. Array bodies use
  `ValidatedJson<Vec<T>>` (blanket impl in `dto/validated.rs`, validates each
  element). Validation failures surface as **422 Unprocessable Entity**.
- Annotate with `ToSchema` so the type appears in the OpenAPI document; register it
  in `AxumApiDoc`. The admin SDK (`admin/src/generated/api-types.ts`) is generated
  from these shapes — changing a DTO is a contract change.
- Keep DTOs as boundary types — don't leak internal DB columns you don't intend to
  expose (especially PII; respect the privacy-by-construction model).
