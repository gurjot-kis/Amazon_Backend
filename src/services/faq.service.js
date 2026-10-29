import mongoose from "mongoose";
import Help from "../models/help.model.js";
import { paginateAggregate } from "./pagination.service.js";

const validateFaq = ({ question, answer }) => {
  if (typeof question !== "string" || !question.trim()) {
    const error = new Error("Question is required");
    error.statusCode = 400;
    throw error;
  }

  if (typeof answer !== "string" || !answer.trim()) {
    const error = new Error("Answer is required");
    error.statusCode = 400;
    throw error;
  }

  return {
    question: question.trim(),
    answer: answer.trim(),
  };
};

const validateFaqId = (faqId) => {
  if (!mongoose.isValidObjectId(faqId)) {
    const error = new Error("Invalid FAQ ID");
    error.statusCode = 400;
    throw error;
  }
};

export const HelpService = {
  createFaq: async (faqData) => {
    const faq = validateFaq(faqData ?? {});
    return await Help.create(faq);
  },

  getAllFaqs: async ({ page = 1, limit = 10 } = {}) => {
    page = Number(page);
    limit = Number(limit);

    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1
    ) {
      const error = new Error("Page and limit must be positive integers");
      error.statusCode = 400;
      throw error;
    }

    limit = Math.min(limit, 100);

    const pipeline = [
      {
        $sort: {
          createdAt: -1,
          _id: -1,
        },
      },
    ];

    return await paginateAggregate(Help, pipeline, {
      page,
      limit,
    });
  },

  getFaqById: async (faqId) => {
    validateFaqId(faqId);

    const faq = await Help.findById(faqId).lean();

    if (!faq) {
      const error = new Error("FAQ not found");
      error.statusCode = 404;
      throw error;
    }

    return faq;
  },

  updateFaq: async (faqId, faqData) => {
    validateFaqId(faqId);

    const faqFields = validateFaq(faqData ?? {});

    const faq = await Help.findByIdAndUpdate(
      faqId,
      { $set: faqFields },
      { new: true, runValidators: true },
    );

    if (!faq) {
      const error = new Error("FAQ not found");
      error.statusCode = 404;
      throw error;
    }

    return faq;
  },

  deleteFaq: async (faqId) => {
    validateFaqId(faqId);

    const faq = await Help.findByIdAndDelete(faqId);

    if (!faq) {
      const error = new Error("FAQ not found");
      error.statusCode = 404;
      throw error;
    }

    return faq;
  },

  getActiveFaqsForMobile: async () => {
    return await Help.find({ status: "active" })
      .select("question answer")
      .sort({ createdAt: -1, _id: -1 })
      .lean();
  },
};

export default HelpService;
