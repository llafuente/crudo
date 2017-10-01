import * as express from "express";
import { Request } from "./app";
import { Voucher } from "./models/Voucher";

// NOTE
// these stats apis cannot be called in parelel atm...

// TODO get test-start

export const customAppRouter = express
  .Router()
  .post("/api/v1/users/redeem-voucher", (req: Request, res: express.Response, next: express.NextFunction) => {
    console.log("BODY:", req.body);
    const label = req.body.voucherKey;

    Voucher.findOne({
      key: label,
    })
      .exec()
      .then((voucher) => {
        if (!voucher) {
          return res.status(404).json({ message: "No se pudo encontrar el Voucher" });
        }

        if (voucher.maxUses == voucher.currentUses) {
          return res.status(400).json({ message: "Voucher ha llegado al número máximo de usos" });
        }

        const now = Date.now();
        if (voucher.startAt.getTime() > now) {
          return res.status(400).json({ message: "Voucher aún no puede ser usado" });
        }

        if (voucher.endAt.getTime() < now) {
          return res.status(400).json({ message: "Voucher ha caducado" });
        }

        ++voucher.currentUses;
        req.loggedUser.voucherId = voucher._id;
        req.loggedUser.testId = voucher.testId;
        voucher
          .save()
          .then(() => {
            return req.loggedUser.save();
          })
          .then(() => {
            res.status(204).json();
          })
          .catch(next);
      });
  })
  .post(
    "/api/v1/users/stats/question-start/:testId/:questionId",
    (req: Request, res: express.Response, next: express.NextFunction) => {
      const testId = req.param("testId", null);
      const questionId = req.param("questionId", null);

      // TODO check testId, questionId

      const statsIdx = req.loggedUser.stats.length;
      req.loggedUser.stats.push({
        testId: testId,
        questionId: questionId,
        type: "question",
        startAt: new Date(),
        endAt: null,
        answers: null,
      });

      //req.loggedUser.stats = [];

      req.loggedUser.markModified("stats");

      req.loggedUser
        .save()
        .then((userSaved) => {
          res.status(200).json({ id: statsIdx });
        })
        .catch(next);
    },
  )
  .post(
    "/api/v1/users/stats/question-end/:testId/:statsIdx/:answerIdx",
    (req: Request, res: express.Response, next: express.NextFunction) => {
      //const testId = req.param("testId", null);
      const statsIdx = req.param("statsIdx", null);
      const answerIdx = req.param("answerIdx", null);

      // TODO check testId, questionId

      const stats = req.loggedUser.stats[statsIdx];
      if (!stats) {
        return res.status(404).json({ message: "Stats not found" });
      }

      stats.endAt = new Date();
      stats.answers = [answerIdx];
      req.loggedUser.markModified("stats");

      console.log("update stats: ", stats);

      req.loggedUser
        .save()
        .then((userSaved) => {
          res.status(204).json();
        })
        .catch(next);
    },
  )
  .post("/api/v1/users/test/resume/:testId", (req: Request, res: express.Response, next: express.NextFunction) => {
    for (let statsIdx = 0; statsIdx < req.loggedUser.stats.length; ++statsIdx) {
      const s = req.loggedUser.stats[statsIdx];

      if (s.type == "test" && s.endAt == null) {
        console.log("incomplete test found at", statsIdx, s);

        const answers = [];
        let elapsedTime = 0;

        for (const stat2 of req.loggedUser.stats) {
          if (stat2.type == "question" && stat2.answers) {
            answers[stat2.questionId] = stat2.answers[0];
          }
          if (stat2.endAt !== null) {
            elapsedTime = stat2.endAt.getTime() - stat2.startAt.getTime();
          }
        }

        return res.status(200).json({
          id: statsIdx,
          answers,
          elapsedTime: Math.floor(elapsedTime / 1000), // seconds
        });
      }
    }

    res.status(200).json({
      id: null,
      answers: null,
      elapsedTime: null,
    });
  })
  .post("/api/v1/users/stats/test-start/:testId", (req: Request, res: express.Response, next: express.NextFunction) => {
    const testId = req.param("testId", null);

    // TODO check testId, questionId

    const statsIdx = req.loggedUser.stats.length;
    req.loggedUser.stats.push({
      testId: testId,
      questionId: null,
      type: "test",
      startAt: new Date(),
      endAt: null,
      answers: null,
    });

    req.loggedUser.markModified("stats");

    req.loggedUser
      .save()
      .then((userSaved) => {
        res.status(200).json({ id: statsIdx });
      })
      .catch(next);
  })
  .post("/api/v1/users/stats/test-end/:testId/", (req: Request, res: express.Response, next: express.NextFunction) => {
    const testId = req.param("testId", null);

    const answers: number[] = req.body.answers;

    // TODO check testId, questionId

    let stats = null;
    req.loggedUser.stats.forEach((stat) => {
      if (stat.type == "test" && stat.testId == testId) {
        stats = stat;
      }
    });

    if (!stats) {
      return res.status(404).json({ message: "Stats not found" });
    }

    stats.endAt = new Date();
    stats.answers = answers;
    req.loggedUser.markModified("stats");
    req.loggedUser.markModified("testsDoneIds");
    req.loggedUser.testsDoneIds = req.loggedUser.testsDoneIds || [];
    req.loggedUser.testsDoneIds.push(req.loggedUser.testId);
    req.loggedUser.testId = null;

    console.log("update stats: ", stats);

    req.loggedUser
      .save()
      .then((userSaved) => {
        res.status(204).json();
      })
      .catch(next);
  });
