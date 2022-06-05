const { config } = require("../config/config.js");

export const sessionOptions = {
    cookieName: "sesh",
    password: config.sessionPassword,
    // secure: true should be used in production (HTTPS) but can't be used in development (HTTP)
    cookieOptions: {
        maxAge: 300, // expire after 5 minutes
        secure: config.useSSL && process.env.NODE_ENV === "production",
    },
    refreshThreshold: 120000, // 2 minutes
    cookieLifetime: 300000 // 5 minutes
};
