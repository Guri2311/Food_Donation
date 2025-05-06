const express = require("express"); 
const router = express.Router();
const middleware = require("../middleware/index.js");
const User = require("../models/user.js");
const Donation = require("../models/donation.js");
const sendEmail = require("../utils/sendEmail.js"); 

// Dashboard
router.get("/admin/dashboard", middleware.ensureAdminLoggedIn, async (req, res) => {
	const numAdmins = await User.countDocuments({ role: "admin" });
	const numDonors = await User.countDocuments({ role: "donor" });
	const numAgents = await User.countDocuments({ role: "agent" });
	const numPendingDonations = await Donation.countDocuments({ status: "pending" });
	const numAcceptedDonations = await Donation.countDocuments({ status: "accepted" });
	const numAssignedDonations = await Donation.countDocuments({ status: "assigned" });
	const numCollectedDonations = await Donation.countDocuments({ status: "collected" });

	res.render("admin/dashboard", {
		title: "Dashboard",
		numAdmins, numDonors, numAgents, numPendingDonations,
		numAcceptedDonations, numAssignedDonations, numCollectedDonations
	});
});

// View pending donations
router.get("/admin/donations/pending", middleware.ensureAdminLoggedIn, async (req, res) => {
	try {
		const pendingDonations = await Donation.find({ status: { $in: ["pending", "accepted", "assigned"] } }).populate("donor");
		res.render("admin/pendingDonations", { title: "Pending Donations", pendingDonations });
	} catch (err) {
		console.error(err);
		req.flash("error", "Server error while fetching pending donations.");
		res.redirect("back");
	}
});

// View previous donations
router.get("/admin/donations/previous", middleware.ensureAdminLoggedIn, async (req, res) => {
	try {
		const previousDonations = await Donation.find({ status: "collected" }).populate("donor");
		res.render("admin/previousDonations", { title: "Previous Donations", previousDonations });
	} catch (err) {
		console.error(err);
		req.flash("error", "Server error while fetching previous donations.");
		res.redirect("back");
	}
});

// View donation detail
router.get("/admin/donation/view/:donationId", middleware.ensureAdminLoggedIn, async (req, res) => {
	try {
		const donation = await Donation.findById(req.params.donationId).populate("donor").populate("agent");
		res.render("admin/donation", { title: "Donation Details", donation });
	} catch (err) {
		console.error(err);
		req.flash("error", "Error viewing donation.");
		res.redirect("back");
	}
});

// Accept donation
router.get("/admin/donation/accept/:donationId", middleware.ensureAdminLoggedIn, async (req, res) => {
	try {
		const donation = await Donation.findByIdAndUpdate(req.params.donationId, { status: "accepted" }, { new: true }).populate("donor");

		await sendEmail({
			to: donation.donor.email,
			subject: "Your Donation Has Been Accepted",
			text: `Hello ${donation.donor.firstName},\n\nYour donation "${donation.itemName}" has been accepted by the admin.\n\nThank you for contributing!`
		});

		req.flash("success", "Donation accepted and donor notified.");
		res.redirect(`/admin/donation/view/${donation._id}`);
	} catch (err) {
		console.error(err);
		req.flash("error", "Error accepting donation.");
		res.redirect("back");
	}
});

// Reject donation
router.get("/admin/donation/reject/:donationId", middleware.ensureAdminLoggedIn, async (req, res) => {
	try {
		const donation = await Donation.findByIdAndUpdate(req.params.donationId, { status: "rejected" }, { new: true }).populate("donor");

		await sendEmail({
			to: donation.donor.email,
			subject: "Your Donation Has Been Rejected",
			text: `Hello ${donation.donor.firstName},\n\nWe're sorry to inform you that your donation "${donation.itemName}" has been rejected.\n\nThank you for your effort.`
		});

		req.flash("success", "Donation rejected and donor notified.");
		res.redirect(`/admin/donation/view/${donation._id}`);
	} catch (err) {
		console.error(err);
		req.flash("error", "Error rejecting donation.");
		res.redirect("back");
	}
});

// Assign agent page
router.get("/admin/donation/assign/:donationId", middleware.ensureAdminLoggedIn, async (req, res) => {
	try {
		const agents = await User.find({ role: "agent" });
		const donation = await Donation.findById(req.params.donationId).populate("donor");
		res.render("admin/assignAgent", { title: "Assign Agent", donation, agents });
	} catch (err) {
		console.error(err);
		req.flash("error", "Error loading agent assignment page.");
		res.redirect("back");
	}
});

// ✅ POST route to assign agent and notify both donor and agent
router.post("/admin/donation/assign/:donationId", middleware.ensureAdminLoggedIn, async (req, res) => {
	try {
		const { agent, adminToAgentMsg } = req.body;

		// Step 1: Update donation status and assign agent
		await Donation.findByIdAndUpdate(req.params.donationId, {
			status: "assigned",
			agent,
			adminToAgentMsg,
		});

		// Step 2: Get updated donation info (with donor and agent)
		const donation = await Donation.findById(req.params.donationId)
			.populate("donor")
			.populate("agent");

		// Step 3: Notify the Donor
		await sendEmail({
			to: donation.donor.email,
			subject: "Agent Assigned to Your Donation",
			text: `Hello ${donation.donor.firstName},\n\nAn agent named ${donation.agent.firstName} has been assigned to collect your donation "${donation.itemName}".\n\nThey may contact you at ${donation.phone}.\n\nThank you for your generous contribution!\n\n- Food Donation Team`,
		});

		// ✅ Step 4: Notify the Agent
		await sendEmail({
			to: donation.agent.email,
			subject: "New Donation Assigned to You",
			text: `Hello ${donation.agent.firstName},\n\nYou have been assigned to collect the donation "${donation.itemName}" from ${donation.donor.firstName}.\n\nPickup Address: ${donation.address}\nContact Number: ${donation.phone}\n\nMessage from Admin: ${adminToAgentMsg || "No message provided."}\n\nPlease log in to your dashboard and proceed with the collection.\n\n- Food Donation Team`,
		});

		req.flash("success", "Agent assigned. Donor and agent notified via email.");
		res.redirect(`/admin/donation/view/${donation._id}`);
	} catch (err) {
		console.error(err);
		req.flash("error", "Error assigning agent.");
		res.redirect("back");
	}
});

// Agents list
router.get("/admin/agents", middleware.ensureAdminLoggedIn, async (req, res) => {
	try {
		const agents = await User.find({ role: "agent" });
		res.render("admin/agents", { title: "List of Agents", agents });
	} catch (err) {
		console.error(err);
		req.flash("error", "Error fetching agents.");
		res.redirect("back");
	}
});

// Admin profile
router.get("/admin/profile", middleware.ensureAdminLoggedIn, (req, res) => {
	res.render("admin/profile", { title: "My Profile" });
});

router.put("/admin/profile", middleware.ensureAdminLoggedIn, async (req, res) => {
	try {
		await User.findByIdAndUpdate(req.user._id, req.body.admin);
		req.flash("success", "Profile updated successfully");
		res.redirect("/admin/profile");
	} catch (err) {
		console.error(err);
		req.flash("error", "Error updating profile.");
		res.redirect("back");
	}
});

module.exports = router;
