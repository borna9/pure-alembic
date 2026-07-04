// Wraps app.json so CI can inject a base URL when deploying the web
// build under a subpath (GitHub Pages serves at /<repo-name>/).
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
