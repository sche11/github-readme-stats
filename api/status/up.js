/**
 * @file Contains a simple cloud function that can be used to check if the PATs are still
 * functional.
 */

import { retryer } from "../../src/common/retryer.js";
import { logger, request, CustomError } from "../../src/common/utils.js";

// Rate limit cloud function.
export const RATE_LIMIT_SECONDS = 60;

/**
 * Simple uptime check fetcher for the PATs.
 * @param {import('axios').AxiosRequestHeaders} variables
 * @param {string} token
 */
const uptimeFetcher = (variables, token) => {
  return request(
    {
      query: `
        query {
          rateLimit {
              remaining
          }
        }
        `,
      variables,
    },
    {
      Authorization: `bearer ${token}`,
    },
  );
};

/**
 * Returns whether the PATs are still functional.
 */
export default async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  try {
    let uptimeRes = await retryer(uptimeFetcher, req);

    if (uptimeRes.data.errors) {
      logger.error(uptimeRes.data.errors);
      throw new CustomError(
        uptimeRes.data.errors[0].message || "Vercel Error",
        "VERCEL_ERROR",
      );
    }
    
    // NOTE: To prevent abuse rate limit to one call per minute.
    res.setHeader("Cache-Control", `max-age=0, s-maxage=${RATE_LIMIT_SECONDS}`);

    res.send(true)
  } catch (err) { 
    if (err.type === CustomError.MAX_RETRY) {
      // Return fail boolean if max retries were exceeded.
      res.send(false)
    } else{
      logger.log(err);
      throw err
    }
  }
};
