/**
 * @file Tests for the status/up cloud function.
 */
import { jest } from "@jest/globals";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import api from "../api/index.js";
import { calculateRank } from "../src/calculateRank.js";
import { renderStatsCard } from "../src/cards/stats-card.js";
import { CONSTANTS, CustomError, renderError } from "../src/common/utils.js";
import up, { RATE_LIMIT_SECONDS } from "../api/status/up.js";
import  retryer  from "../src/common/retryer.js";

jest.mock("../src/common/retryer.js");

const mock = new MockAdapter(axios);

const successData = {
  rateLimit: {
    remaining: 4986,
  },
};

const faker = (query) => {
  const req = {
    query: { ...query },
  };
  const res = {
    setHeader: jest.fn(),
    send: jest.fn(),
  };

  return { req, res };
};

const error = {
  errors: [
    {
      type: "VERCEL_ERROR",
      message: "Vercel Error",
    },
  ],
};

afterEach(() => {
  mock.reset();
});
const fetcherFail = { data: { errors: [{ type: "MAX_RETRY" }] } };

describe("Test /api/status/up", () => {
  it("should return `true` if request was successful", async () => {
    mock.onPost("https://api.github.com/graphql").replyOnce(200, successData);

    const { req, res } = faker({}, {});

    await up(req, res);

    expect(res.setHeader).toBeCalledWith("Content-Type", "application/json");
    expect(res.send).toBeCalledWith(true);
  });

  it("should return `false` if 'MAX_RETRY' error is returned", async () => {
    
    retryer.mockRejectedValue(
      new CustomError("Maximum retries exceeded", CustomError.MAX_RETRY),
    );

    const { req, res } = faker({}, {});

    await up(req, res);

    expect(res.setHeader).toBeCalledWith("Content-Type", "application/json");
    expect(res.send).toBeCalledWith(false);
  });

    it("should forward error on error", async () => {
      mock.onPost("https://api.github.com/graphql").replyOnce(200, { ...error });

      const { req, res } = faker({}, {});

      await up(req, res).rejects.toThrow("Vercel Error");
    });

    it("should have proper cache", async () => {
      const { req, res } = faker({}, {});

      await up(req, res);

      expect(res.setHeader.mock.calls).toEqual([
        ["Content-Type", "application/json"],
        ["Cache-Control", `max-age=0, s-maxage=${RATE_LIMIT_SECONDS}`],
      ]);
    });
});
