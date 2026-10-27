import Wallet from "../models/wallet.model.js";
import WalletTransaction, {
  WALLET_TXN_SOURCES,
  WALLET_TXN_TYPES,
} from "../models/walletTransaction.model.js";
import { AppError } from "../utils/AppError.js";
import { toObjectId } from "../utils/object-id.js";
import { runInTransaction } from "../utils/transaction.js";
import { buildPagination, parsePagination } from "./pagination.service.js";

const idToString = (value) => (value == null ? null : String(value));

const mapWallet = (wallet) => ({
  _id: idToString(wallet._id),
  user_id: idToString(wallet.user_id),
  balance: wallet.balance / 100,
  balance_paise: wallet.balance,
  currency: wallet.currency,
  status: wallet.status,
});

const mapTransaction = (txn) => ({
  _id: idToString(txn._id),
  type: txn.type,
  amount: txn.amount / 100,
  amount_minor: txn.amount,
  balance_after: txn.balance_after / 100,
  source: txn.source,
  reference_type: txn.reference_type || null,
  reference_id: idToString(txn.reference_id),
  note: txn.note || "",
  createdAt: txn.createdAt,
});

const inSession = (session, work) =>
  session ? work(session) : runInTransaction(work);

const validateEntry = ({ amount, source, idempotency_key }) => {
  if (!Number.isInteger(amount) || amount < 1) {
    throw new AppError(400, "Amount must be a positive integer (paise)");
  }
  if (!WALLET_TXN_SOURCES.includes(source)) {
    throw new AppError(400, "Invalid wallet transaction source");
  }
  if (!idempotency_key) {
    throw new AppError(400, "idempotency_key is required");
  }
};

const findDuplicate = (key, session) =>
  WalletTransaction.findOne({ idempotency_key: key })
    .session(session)
    .lean()
    .exec();

const writeLedger = async ({
  wallet,
  type,
  amount,
  source,
  reference,
  idempotency_key,
  note,
  created_by,
  session,
}) => {
  const [txn] = await WalletTransaction.create(
    [
      {
        wallet_id: wallet._id,
        user_id: wallet.user_id,
        type,
        amount,
        balance_after: wallet.balance,
        source,
        reference_type: reference?.type ?? null,
        reference_id: reference?.id ?? null,
        idempotency_key,
        note: String(note ?? "").slice(0, 500),
        created_by: created_by ?? null,
      },
    ],
    { session },
  );
  return txn.toObject();
};

const getOrCreateWallet = async ({ user_id, session } = {}) => {
  const userId = toObjectId(user_id, "user_id");

  try {
    return await Wallet.findOneAndUpdate(
      { user_id: userId },
      { $setOnInsert: { balance: 0, currency: "INR", status: "active" } },
      { upsert: true, new: true, setDefaultsOnInsert: true, session },
    )
      .lean()
      .exec();
  } catch (err) {
    if (err?.code === 11000) {
      return Wallet.findOne({ user_id: userId }).session(session).lean().exec();
    }
    throw err;
  }
};

export const WalletService = {
  mapWallet,
  getOrCreateWallet,

  getBalance: async ({ user_id }) => {
    const wallet = await getOrCreateWallet({ user_id });
    return mapWallet(wallet);
  },

  credit: ({
    user_id,
    amount,
    source,
    reference = null,
    idempotency_key,
    note = "",
    created_by = null,
    maxBalance = null,
    session,
  }) =>
    inSession(session, async (s) => {
      validateEntry({ amount, source, idempotency_key });

      const duplicate = await findDuplicate(idempotency_key, s);
      if (duplicate) {
        return {
          transaction: duplicate,
          balance: duplicate.balance_after,
          duplicate: true,
        };
      }

      const existing = await getOrCreateWallet({ user_id, session: s });

      const filter = { _id: existing._id };
      if (maxBalance != null) filter.balance = { $lte: maxBalance - amount };

      const wallet = await Wallet.findOneAndUpdate(
        filter,
        { $inc: { balance: amount } },
        { new: true, session: s },
      )
        .lean()
        .exec();
      if (!wallet) throw new AppError(409, "Wallet balance limit exceeded");

      const transaction = await writeLedger({
        wallet,
        type: "credit",
        amount,
        source,
        reference,
        idempotency_key,
        note,
        created_by,
        session: s,
      });
      return { transaction, balance: wallet.balance, duplicate: false };
    }),

  debit: ({
    user_id,
    amount,
    source,
    reference = null,
    idempotency_key,
    note = "",
    created_by = null,
    session,
  }) =>
    inSession(session, async (s) => {
      const userId = toObjectId(user_id, "user_id");
      validateEntry({ amount, source, idempotency_key });

      const duplicate = await findDuplicate(idempotency_key, s);
      if (duplicate) {
        return {
          transaction: duplicate,
          balance: duplicate.balance_after,
          duplicate: true,
        };
      }

      const wallet = await Wallet.findOneAndUpdate(
        { user_id: userId, status: "active", balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { new: true, session: s },
      )
        .lean()
        .exec();

      if (!wallet) {
        const current = await Wallet.findOne({ user_id: userId })
          .session(s)
          .lean()
          .exec();
        if (current && current.status !== "active") {
          throw new AppError(403, "Wallet is not active");
        }
        throw new AppError(409, "Insufficient wallet balance");
      }

      const transaction = await writeLedger({
        wallet,
        type: "debit",
        amount,
        source,
        reference,
        idempotency_key,
        note,
        created_by,
        session: s,
      });
      return { transaction, balance: wallet.balance, duplicate: false };
    }),

  listTransactions: async ({ user_id, type, page, limit }) => {
    const userId = toObjectId(user_id, "user_id");
    const filter = { user_id: userId };

    if (type) {
      const normalized = String(type).trim().toLowerCase();
      if (!WALLET_TXN_TYPES.includes(normalized)) {
        throw new AppError(400, "Invalid transaction type");
      }
      filter.type = normalized;
    }

    const pagination = parsePagination({ page, limit });
    const [txns, total] = await Promise.all([
      WalletTransaction.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean()
        .exec(),
      WalletTransaction.countDocuments(filter).exec(),
    ]);

    return {
      transactions: txns.map(mapTransaction),
      pagination: buildPagination(total, pagination),
    };
  },
};

export default WalletService;
