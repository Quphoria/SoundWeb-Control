const { config } = require("../config/config.js");

export const sessionOptions = {
    cookieName: "sesh",
    password: config.sessionPassword,
    // secure: true should be used in production (HTTPS) but can't be used in development (HTTP)
    cookieOptions: {
        secure: config.useSSL && process.env.NODE_ENV === "production",
    },
};