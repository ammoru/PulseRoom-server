import mongoose, { Schema, Types } from "mongoose";

export type PollOption = {
  _id: Types.ObjectId;
  text: string;
  votes: number;
};

export type PollDocument = mongoose.Document & {
  question: string;
  options: mongoose.Types.DocumentArray<PollOption>;
  voters: string[];
  createdAt: Date;
  updatedAt: Date;
};

const OptionSchema = new Schema<PollOption>(
  {
    text: { type: String, required: true },
    votes: { type: Number, default: 0 },
  },
  { _id: true }
);

const PollSchema = new Schema<PollDocument>(
  {
    question: { type: String, required: true, trim: true },
    options: {
      type: [OptionSchema],
      validate: {
        validator: (options: PollOption[]) => options.length >= 2,
        message: "Poll must have at least two options.",
      },
      required: true,
    },
    voters: { type: [String], default: [] },
  },
  { timestamps: true }
);

const Poll = mongoose.model<PollDocument>("Poll", PollSchema);

export default Poll;
