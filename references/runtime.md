# Runtime instructions (Codex and Claude Code)

Resolve `SEOBLOG_PLUGIN_ROOT` to the absolute plugin directory from the loaded
file's location: a skill is at `<plugin>/skills/<name>/SKILL.md`, a command at
`<plugin>/commands/<name>.md`, and this file at `<plugin>/references/runtime.md`.
Use that absolute path in script calls, or set the task-specific shell variable
`SEOBLOG_PLUGIN_ROOT` in each shell call. Do not assume variables persist across
calls or that `CLAUDE_PLUGIN_ROOT` is defined. Quote paths containing spaces.
Preserve the caller's working directory: SocialCue discovers its project store
from there. Do not change into the installed plugin to run workflows.

Use the host's shell for scripts, file tools for text, web search/open for
`WebSearch`/`WebFetch`, clarification tools for `AskUserQuestion`, and a visual
image viewer for image `Read`. Never claim visual review from file metadata.
Load sibling skills through relative links/files, not assumed installed names.
Claude slash commands mentioned in these documents are user-facing Claude
shortcuts, not Codex tools. In Codex, select the corresponding installed skill
or ask in natural language.

## Preflight and dependencies

- Blog writing: resolve the requested site, otherwise defaultSite or the only
  site; run `node "${SEOBLOG_PLUGIN_ROOT}/scripts/doctor.mjs" --workflow blog --site <id>`.
  With no resolvable site, stop with setup guidance. Honor explicit no-images
  requests by adding `--text-only`. Do not start an interview during unattended
  writing. Missing web research capability is a blocker, not permission to
  invent sources.
- SocialCue: run `doctor.mjs --workflow socialcue --text-only`, then
  `socialcue.mjs locate`. This does not require a CMS site. When generating and
  hosting images, additionally check the selected host site with
  `doctor.mjs --workflow blog --site <id>`.
- Setup/status: the existing `doctor.mjs [--site <id>]` invocation checks all
  configured sites (or the named site); no site is acceptable during setup.
- FAL is optional. Missing FAL credentials means write without FAL images.
  Missing image packages only block an enabled FAL image workflow. Install
  them with `npm ci --prefix "${SEOBLOG_PLUGIN_ROOT}"` and rerun the check.
  Dependencies belong in the resolved installation, not only the source clone;
  a new plugin cache may need installation again. Never install Node itself
  automatically; report the Node 20+ requirement if absent.
- Respect the active host's image-generation tool/skill requirements. The
  existing FAL CLI is the default where permitted. If another provider is
  required or explicitly requested, adapt generation while retaining visual
  review, required dimensions, hosting, and honest provider/cost reporting.
  Do not apply FAL prices or FAL credential requirements to another provider.

## Data and authorization

Configuration is `${XDG_CONFIG_HOME:-$HOME/.config}/seoblog/config.json` and
state is the sibling `state/` directory; examples using `~/.config` assume no
XDG override. Preserve existing config/state keys when editing them. Never
print whole config files that might contain legacy credentials.
Write article payloads and generated images to a session scratch directory
outside the plugin installation. Never put secrets, user config, or article
history inside a versioned plugin cache.

Use existing user authorization for requested drafts or explicit publishing;
no extra editorial confirmation is needed. Host filesystem/network permissions
still apply. Prepare payloads before requesting any necessary escalation.
CMS articles are created as drafts; publishing is a separate explicit action.
If a remote write has an ambiguous outcome, inspect existing records before
retrying. Report state-recording failures separately from successful saves.

For secrets, give the user terminal instructions, never request keys in chat.
On macOS use Keychain service `seoblog`, accounts `FAL_API_KEY` and `site:<id>`.
Else use `FAL_API_KEY` and `SEOBLOG_SITE_<NORMALIZED_ID>_API_KEY` in the environment
of the Codex/Claude process; uppercase the site id and replace non-alphanumeric
runs with underscores. Do not change existing credential resolution precedence.
