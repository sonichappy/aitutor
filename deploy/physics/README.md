# Family physics application

The student application is `/physics`. The authenticated administrator account is
`administrator`; students have separate accounts and synchronized learning records.
The admin interface includes question browsing, open/resolved issues and student
management. Open issues exclude a question from all student practice entry points.
Student calendar statistics use Asia/Shanghai dates and distinguish submissions
from distinct questions. Subjective correctness includes student self-assessment.

## Source and private data

Git contains application code, Python tools, tests and container configuration.
It does **not** contain question databases, original papers, source-page images,
student records, API credentials, conversion output or session cookies.

Provide the private data directory separately, with this layout:

```
physics/
  question-bank/physics.db
  question-bank/assets/
  question-bank/sources/
  _state/family/study.db
  ...original source directories referenced by the paper inventory...
```

For local development, place it at `physics-exam-papers/`, or set `PHYSICS_ROOT`,
`PHYSICS_BANK_ROOT` and `PHYSICS_FAMILY_DB` appropriately. Install Node dependencies
with `npm ci`, create `.venv`, and install `_scripts/requirements.txt`.
Then use the repository's Next.js development command and open `/physics`.
A new empty study database supports setup; existing accounts retain their passwords.
Never overwrite a deployed study database with a local copy.

## Validation

```
.venv/bin/python -m unittest discover -s physics-exam-papers/_scripts -p test_family_physics.py
npx tsc --noEmit
```

Tests create isolated temporary databases and do not need model API access.
The family application itself makes no model calls.

## Containers

Copy `.env.example` to `.env` in this directory and set `PHYSICS_DATA_DIR` to the
persistent host directory. Then run `docker compose up -d --build` here.
The build stages only the physics frontend and API, independently of other apps
in this repository. Runtime SQLite files and images are mounted at `/data/physics`;
Caddy certificate storage uses named persistent volumes.

For public HTTPS, configure `SITE_ADDRESS` with the domain, `BIND_ADDRESS=0.0.0.0`,
`HTTP_PORT=80`, `HTTPS_PORT=443`. Point DNS at the server and allow TCP 80/443.
Keep `.env` private. Use `backup.py` before upgrades or data migrations.
`finish-upload.py` is a deployment-specific one-shot upload supervisor; its host
paths and archive digest must match the deployment, and it refuses to overwrite
an existing study database.

## Original-paper association tools

`source_association_tasks.py` provides local `run`, `status` and `stop` commands.
`complete_source_associations.py` processes the remaining list from the first
association survey; that survey and source files belong to the private data package.
Both preserve question bodies, existing figure assignments and human crop history.
They are local operations with no AI API calls. Word/PDF conversion needs
LibreOffice, Poppler and Chinese fonts. Page associations do not certify crop
correctness, printed page numbering, source completeness or converted layout.

Recurring parser/candidate tools are separate. Do not clear their persistent STOP
markers or resume their schedules without explicit authorization. They remain
manually paused in the current deployment. Model credentials are loaded from a
private environment file; never commit that file. Incremental source-page updates
must merge association records and preserve server learning data and human edits.
