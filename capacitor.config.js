// NOTE: appId / appName are placeholders until the final game name is chosen.
// Renaming later = one-line change here + a new App Store Connect record.
const config = {
  appId: 'com.isyndicate.game',
  appName: 'iSyndicate',
  webDir: 'client/dist',
  ios: {
    // Keep the web content opaque to ATS exceptions: all API traffic is https.
    limitsNavigationsToAppBoundDomains: true,
  },
};

module.exports = config;
