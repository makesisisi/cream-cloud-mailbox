export default {
  userSignup(event) {
    const currentRoles = event.user.appMetadata?.roles ?? [];
    return {
      user: {
        ...event.user,
        appMetadata: {
          ...event.user.appMetadata,
          roles: currentRoles.length ? currentRoles : ["client"],
        },
      },
    };
  },
};
