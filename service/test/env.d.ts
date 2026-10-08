import type { Env as ServiceEnv } from "../src/types";
declare global { namespace Cloudflare { interface Env extends ServiceEnv {} } }
