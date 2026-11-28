// models/BloodRequest.js
import mongoose from "mongoose";

const bloodRequestSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    patientName: { type: String, required: true },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      required: true,
      index: true,
    },
    component: { type: String, enum: ["whole_blood", "red_cells", "platelets", "plasma"], default: "whole_blood" },
    unitsNeeded: { type: Number, required: true, min: 1 },
    hospital: { type: String, required: true },
    district: { type: String, required: true, index: true },
    location: {
  type: { type: String, enum: ["Point"] },        // no default
  coordinates: { type: [Number], default: undefined }, // [lng, lat]
},
    contactPhone: { type: String, required: true },
    neededBy: { type: Date, required: true },
    notes: String,
    rawText: String, // original free-text message (used by AI parsing)

    urgency: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    status: {
      type: String,
      enum: ["open", "in_progress", "fulfilled", "cancelled", "expired"],
      default: "open",
      index: true,
    },

    // AI-generated fields
    ai: {
      urgencyScore: Number, // 0-100
      reasoning: String,
      parsedFromText: { type: Boolean, default: false },
    },

    matchedDonors: [
      {
        donor: { type: mongoose.Schema.Types.ObjectId, ref: "DonorProfile" },
        matchScore: Number,
        response: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
        notifiedAt: Date,
        // Set when the requester confirms this donor actually gave blood (models/Donation.js)
        donation: { type: mongoose.Schema.Types.ObjectId, ref: "Donation" },
        // Live trip of an accepted donor (docs/maps-and-live-tracking.md §2).
        // lat/lng/accuracy exist only while status is "on_the_way" and are seen only by
        // the requester, admins and the donor themself (see controllers/tripController.js).
        trip: {
          type: new mongoose.Schema(
            {
              status: { type: String, enum: ["on_the_way", "arrived", "stopped"], required: true },
              startedAt: Date,
              updatedAt: Date, // last location update or status change
              endedAt: Date,
              lat: Number,
              lng: Number,
              accuracy: Number, // metres, from the browser
            },
            { _id: false }
          ),
          default: undefined,
        },
      },
    ],
    fulfilledUnits: { type: Number, default: 0 },
    autoNotify: {
      at: Date, // when matching donors were alerted automatically
      notified: Number, // donors alerted in the app
      widened: Boolean, // also searched other districts because none were found nearby
      emailed: Number, // donors also alerted by email (urgent requests only)
    },
  },
  { timestamps: true }
);

bloodRequestSchema.index({ location: "2dsphere" }, { sparse: true });
bloodRequestSchema.index({ status: 1, urgency: 1, neededBy: 1 });

export default mongoose.model("BloodRequest", bloodRequestSchema);