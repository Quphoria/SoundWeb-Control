import { basePath } from "../next.config";

export const github_url = "https://github.com/Quphoria";

export const app_title = "Example App";

const base = basePath; // Take basePath from next.config.js
export const base_url = base;

// NextJS automaticallys add the basePath to the following urls
export const home_url = `/`;
export const panel_url = `/panel`;
export const admin_url = `/admin`;
export const login_url = `/login`;
export const logout_url = `/logout`;

// NextJS doesn't automatically add the basePath to the following urls
export const favicon_url = `${base}/favicon.ico`;

const api = `${base}/api`;

// Api

export const api_user_url = `${api}/user`;
export const api_test_url = `${api}/test`;
export const api_admin_test_url = `${api}/admin-test`;