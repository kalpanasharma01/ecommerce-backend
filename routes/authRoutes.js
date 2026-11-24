const express = require("express");
const authController = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/register", authController.registerUser);

router.post("/login", authController.loginUser);

router.get("/profile", protect, (req, res) => {
  res.json(req.user);
});

router.get(
  "/admin",
  protect,
  authorizeRoles("Admin"),
  (req, res) => {
    res.json({ message: "Welcome Admin" });
  }
);

router.get(
  "/seller",
  protect,
  authorizeRoles("Seller"),
  (req, res) => {
    res.json({ message: "Welcome Seller" });
  }
);

module.exports = router;