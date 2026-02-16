import express from "express";
import { z } from "zod";
import type { Server } from "socket.io";
import Poll, { type PollDocument } from "../models/Poll";
import { checkRateLimit } from "../middleware/rateLimit";

const router = express.Router();

const createPollSchema = z.object({
  question: z.string().trim().min(5).max(200),
  options: z
    .array(z.string().trim().min(1).max(80))
    .min(2)
    .max(10),
});

const voteSchema = z.object({
  optionId: z.string().trim().min(1),
  voterId: z.string().trim().min(8).max(64),
});

function toPollResponse(poll: PollDocument) {
  const data = poll.toObject({ versionKey: false });
  delete data.voters;
  const totalVotes = data.options.reduce(
    (sum: number, option: { votes: number }) => sum + option.votes,
    0
  );
  return { ...data, totalVotes };
}

function getClientIp(req: express.Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "unknown";
}

router.post("/", async (req, res) => {
  const parseResult = createPollSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "Invalid poll payload." });
  }

  const { question, options } = parseResult.data;
  const poll = await Poll.create({
    question,
    options: options.map((text) => ({ text })),
  });

  return res.status(201).json(toPollResponse(poll));
});

router.get("/:pollId", async (req, res) => {
  const { pollId } = req.params;
  const poll = await Poll.findById(pollId);

  if (!poll) {
    return res.status(404).json({ message: "Poll not found." });
  }

  return res.json(toPollResponse(poll));
});

router.post("/:pollId/vote", async (req, res) => {
  const { pollId } = req.params;
  const parseResult = voteSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "Invalid vote payload." });
  }

  const { optionId, voterId } = parseResult.data;
  const ip = getClientIp(req);
  const windowMs = Number(process.env.VOTE_WINDOW_MS ?? 60000);
  const maxAttempts = Number(process.env.VOTE_MAX_ATTEMPTS ?? 5);
  const rateResult = checkRateLimit(`${pollId}:${ip}`, windowMs, maxAttempts);

  if (!rateResult.ok) {
    return res.status(429).json({
      message: "Too many vote attempts. Try again shortly.",
      retryAfterMs: rateResult.retryAfterMs,
    });
  }

  const poll = await Poll.findById(pollId);
  if (!poll) {
    return res.status(404).json({ message: "Poll not found." });
  }

  if (poll.voters.includes(voterId)) {
    return res.status(409).json({ message: "You already voted on this poll." });
  }

  const option = poll.options.id(optionId);
  if (!option) {
    return res.status(400).json({ message: "Option does not exist." });
  }

  option.votes += 1;
  poll.voters.push(voterId);
  await poll.save();

  const response = toPollResponse(poll);
  const io = req.app.get("io") as Server | undefined;
  io?.to(`poll:${pollId}`).emit("poll:update", response);

  return res.json(response);
});

export default router;
