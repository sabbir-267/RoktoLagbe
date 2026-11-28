// Where a "Become a donor" button should go, or null to hide it:
// guests sign up, logged-in non-donors create their donor profile, donors don't see it.
export const becomeDonorLink = (user) => (!user ? "/register" : user.isDonor ? null : "/donor-profile");
