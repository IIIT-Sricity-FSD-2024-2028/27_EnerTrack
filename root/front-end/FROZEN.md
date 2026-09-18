# This folder is frozen

The React port in `root/front-end-react` replaces it.

**Do not fix bugs here.** Anything fixed in this folder has to be fixed twice,
once here and once in the port, and the two will drift.

It stays in the repo for two reasons:

1. It is the reference you read while porting your pages — the behaviour the
   React version has to reproduce.
2. It is the fallback if the port is not ready on evaluation day.

If you find a bug in a page here, fix it in the ported React page instead and
note it in the pull request.
