import { onRequest as __api_auth_login_ts_onRequest } from "C:\\Users\\ashut\\OneDrive\\Desktop\\College Projects\\Edumark\\functions\\api\\auth\\login.ts"
import { onRequest as __api_auth_signup_ts_onRequest } from "C:\\Users\\ashut\\OneDrive\\Desktop\\College Projects\\Edumark\\functions\\api\\auth\\signup.ts"
import { onRequest as __api_test_ts_onRequest } from "C:\\Users\\ashut\\OneDrive\\Desktop\\College Projects\\Edumark\\functions\\api\\test.ts"

export const routes = [
    {
      routePath: "/api/auth/login",
      mountPath: "/api/auth",
      method: "",
      middlewares: [],
      modules: [__api_auth_login_ts_onRequest],
    },
  {
      routePath: "/api/auth/signup",
      mountPath: "/api/auth",
      method: "",
      middlewares: [],
      modules: [__api_auth_signup_ts_onRequest],
    },
  {
      routePath: "/api/test",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_test_ts_onRequest],
    },
  ]