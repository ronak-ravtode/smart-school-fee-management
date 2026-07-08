import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess, sendPaginatedSuccess } from "@/utils/apiResponse";
import * as ledgerService from "@/services/ledgerService";
import {
  GenerateLedgerInput,
  StudentLedgerParamsInput,
  LedgerQueryInput,
} from "./schemas";

export const generateLedgers = asyncHandler(
  async (req: Request, res: Response) => {
    const input = req.body as GenerateLedgerInput;
    const result = await ledgerService.generateLedgersForClass({
      class: input.class,
      section: input.section,
      academicSession: input.academicSession,
      month: input.month,
      dueDate: new Date(input.dueDate),
    });
    res.status(201).json(
      sendSuccess(
        {
          created: result.created,
          skipped: result.skipped,
          total: result.total,
        },
        `Generated ${result.created} ledger(s), skipped ${result.skipped} existing`
      )
    );
  }
);

export const getStudentLedgers = asyncHandler(
  async (req: Request, res: Response) => {
    const { studentId } = req.params as StudentLedgerParamsInput;
    const ledgers = await ledgerService.getLedgersByStudent(studentId);
    res.json(sendSuccess(ledgers, "Student ledgers fetched"));
  }
);

export const getDefaulters = asyncHandler(
  async (_req: Request, res: Response) => {
    const defaulters = await ledgerService.getDefaulters();
    res.json(sendSuccess(defaulters, "Defaulters fetched"));
  }
);
