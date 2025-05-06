const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const passport = require("passport");
const User = require("../models/user.js");
const Otp = require("../models/otp.js");
const sendEmail = require("../utils/sendEmail.js");
const middleware = require("../middleware/index.js");

// Show Signup Page
router.get("/auth/signup", middleware.ensureNotLoggedIn, (req, res) => {
	res.render("auth/signup", { title: "User Signup" });
});

// Handle Signup Form and Send OTP
router.post("/auth/signup", middleware.ensureNotLoggedIn, async (req, res) => {
	const { firstName, lastName, email, password1, password2, role } = req.body;
	let errors = [];

	if (!firstName || !lastName || !email || !password1 || !password2) {
		errors.push({ msg: "Please fill in all the fields" });
	}
	if (password1 !== password2) {
		errors.push({ msg: "Passwords are not matching" });
	}
	if (password1.length < 4) {
		errors.push({ msg: "Password length should be at least 4 characters" });
	}

	if (errors.length > 0) {
		return res.render("auth/signup", {
			title: "User Signup",
			errors, firstName, lastName, email, password1, password2
		});
	}

	try {
		const existingUser = await User.findOne({ email: email });
		if (existingUser) {
			errors.push({ msg: "This Email is already registered. Please try another email." });
			return res.render("auth/signup", {
				title: "User Signup",
				firstName, lastName, errors, email, password1, password2
			});
		}

		// Generate OTP
		const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

		// Save OTP to DB
		await Otp.create({ email, otp: otpCode });

		// Send OTP via email
		await sendEmail(email, "Verify Your Email", `Your OTP is: ${otpCode}`);

		// Save user data temporarily in session
		req.session.tempUser = {
			firstName,
			lastName,
			email,
			password: password1,
			role
		};

		// Show OTP form
		res.render("auth/verifyotp", { email, error: null, resendSuccess: null, resendError: null });

	} catch (err) {
		console.error(err);
		req.flash("error", "Something went wrong. Please try again.");
		res.redirect("back");
	}
});

// Handle OTP Verification
router.post("/auth/verify-otp", async (req, res) => {
	const { otp } = req.body;
	const tempUser = req.session.tempUser;

	if (!tempUser) {
		req.flash("error", "Session expired. Please sign up again.");
		return res.redirect("/auth/signup");
	}

	const otpRecord = await Otp.findOne({ email: tempUser.email });

	if (!otpRecord || otpRecord.otp !== otp) {
		return res.render("auth/verifyotp", {
			email: tempUser.email,
			error: "Invalid or expired OTP. Please try again.",
			resendSuccess: null,
			resendError: null
		});
	}

	// OTP is valid — create user
	const salt = bcrypt.genSaltSync(10);
	const hash = bcrypt.hashSync(tempUser.password, salt);

	const newUser = new User({
		firstName: tempUser.firstName,
		lastName: tempUser.lastName,
		email: tempUser.email,
		password: hash,
		role: tempUser.role,
	});

	await newUser.save();
	await Otp.deleteMany({ email: tempUser.email }); // Clean up OTPs
	req.session.tempUser = null;

	req.flash("success", "You are successfully registered and can log in.");
	res.redirect("/auth/login");
});

// ✅ NEW: Handle Resend OTP
router.post("/auth/resend-otp", async (req, res) => {
	const { email } = req.body;

	if (!email) {
		return res.render("auth/verifyotp", {
			email: "",
			error: null,
			resendError: "Email missing. Please sign up again.",
			resendSuccess: null
		});
	}

	try {
		// Generate new OTP
		const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

		// Update or create OTP in DB
		await Otp.findOneAndUpdate(
			{ email },
			{ otp: otpCode },
			{ upsert: true, new: true }
		);

		// Send new OTP
		await sendEmail(email, "[Food Donation System] New OTP Verification", `Your new OTP is: ${otpCode}`);

		// Render the form again with success message
		res.render("auth/verifyotp", {
			email,
			error: null,
			resendError: null,
			resendSuccess: "New OTP has been sent to your email."
		});

	} catch (err) {
		console.error(err);
		return res.render("auth/verifyotp", {
			email,
			error: null,
			resendError: "Something went wrong. Please try again.",
			resendSuccess: null
		});
	}
});

// Show Login Page
router.get("/auth/login", middleware.ensureNotLoggedIn, (req, res) => {
	res.render("auth/login", { title: "User Login" });
});

// Handle Login
router.post("/auth/login", middleware.ensureNotLoggedIn,
	passport.authenticate('local', {
		failureRedirect: "/auth/login",
		failureFlash: true,
		successFlash: true
	}),
	(req, res) => {
		res.redirect(req.session.returnTo || `/${req.user.role}/dashboard`);
	}
);

// Logout
router.get("/auth/logout", (req, res) => {
	req.logout(); // No callback
	req.flash("success", "You are logged out!");
	res.redirect("/");
	});


module.exports = router;
