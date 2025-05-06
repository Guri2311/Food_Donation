const express = require("express");
const router = express.Router();
const middleware = require("../middleware/index.js");
const User = require("../models/user.js");
const Donation = require("../models/donation.js");
const sendEmail = require("../utils/sendEmail.js"); 

// Agent Dashboard
router.get("/agent/dashboard", middleware.ensureAgentLoggedIn, async (req, res) => {
	const agentId = req.user._id;
	const numAssignedDonations = await Donation.countDocuments({ agent: agentId, status: "assigned" });
	const numCollectedDonations = await Donation.countDocuments({ agent: agentId, status: "collected" });
	res.render("agent/dashboard", {
		title: "Dashboard",
		numAssignedDonations, 
		numCollectedDonations
	});
});

// View Pending Collections
router.get("/agent/collections/pending", middleware.ensureAgentLoggedIn, async (req, res) => {
	try {
		const pendingCollections = await Donation.find({ agent: req.user._id, status: "assigned" }).populate("donor");
		res.render("agent/pendingCollections", { title: "Pending Collections", pendingCollections });
	} catch (err) {
		console.log(err);
		req.flash("error", "Some error occurred on the server.");
		res.redirect("back");
	}
});

// View Previous Collections
router.get("/agent/collections/previous", middleware.ensureAgentLoggedIn, async (req, res) => {
	try {
		const previousCollections = await Donation.find({ agent: req.user._id, status: "collected" }).populate("donor");
		res.render("agent/previousCollections", { title: "Previous Collections", previousCollections });
	} catch (err) {
		console.log(err);
		req.flash("error", "Some error occurred on the server.");
		res.redirect("back");
	}
});

// View Collection Details
router.get("/agent/collection/view/:collectionId", middleware.ensureAgentLoggedIn, async (req, res) => {
	try {
		const collectionId = req.params.collectionId;
		const collection = await Donation.findById(collectionId).populate("donor");
		res.render("agent/collection", { title: "Collection Details", collection });
	} catch (err) {
		console.log(err);
		req.flash("error", "Some error occurred on the server.");
		res.redirect("back");
	}
});

// Collect Donation and Send Notifications
router.get("/agent/collection/collect/:collectionId", middleware.ensureAgentLoggedIn, async (req, res) => {
	try {
		const collectionId = req.params.collectionId;

		const updatedDonation = await Donation.findByIdAndUpdate(
			collectionId,
			{
				status: "collected",
				collectionTime: Date.now()
			},
			{ new: true }
		).populate("donor").populate("agent");

		const donorEmail = updatedDonation.donor.email;
		const agentName = updatedDonation.agent.firstName;
		const donorName = updatedDonation.donor.firstName;
		const item = updatedDonation.itemName || updatedDonation.foodType;
		const time = new Date(updatedDonation.collectionTime).toLocaleString("en-IN");

		// ✅ Email to Donor
		await sendEmail({
			to: donorEmail,
			subject: "Your Donation Has Been Collected",
			text: `Hello ${donorName},\n\nYour donation "${item}" has been successfully collected by our agent ${agentName} on ${time}.\n\nThank you for your kind support!\n\nRegards,\nTeam Food Donation`
		});

		// ✅ Email to Admin (Replace hardcoded email if needed)
		await sendEmail({
			to: "gursimrankaur23004@gmail.com",
			subject: "Donation Collected Notification",
			text: `Hello Admin,\n\nAgent ${agentName} has collected the donation "${item}" from donor ${donorName} on ${time}.\n\nBest Regards,\nSystem`
		});

		req.flash("success", "Donation marked as collected and notifications sent.");
		res.redirect(`/agent/collection/view/${collectionId}`);
	} catch (err) {
		console.log(err);
		req.flash("error", "Error occurred while marking donation as collected.");
		res.redirect("back");
	}
});

// Agent Profile View
router.get("/agent/profile", middleware.ensureAgentLoggedIn, (req, res) => {
	res.render("agent/profile", { title: "My Profile" });
});

// Agent Profile Update
router.put("/agent/profile", middleware.ensureAgentLoggedIn, async (req, res) => {
	try {
		const id = req.user._id;
		const updateObj = req.body.agent;
		await User.findByIdAndUpdate(id, updateObj);

		req.flash("success", "Profile updated successfully");
		res.redirect("/agent/profile");
	} catch (err) {
		console.log(err);
		req.flash("error", "Some error occurred on the server.");
		res.redirect("back");
	}
});

module.exports = router;
