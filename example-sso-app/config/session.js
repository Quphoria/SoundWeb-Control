const { config } = require("../config/config.js");

export const sessionOptions = {
    cookieName: "example_app_sesh",
    password: config.sessionPassword,
    // secure: true should be used in production (HTTPS) but can't be used in development (HTTP)
    cookieOptions: {
        maxAge: config.sessionCookieLifetime, // expire after 5 minutes
        secure: config.useSSL && process.env.NODE_ENV === "production",
    }
};
