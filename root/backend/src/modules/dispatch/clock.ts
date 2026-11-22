import { Injectable } from "@nestjs/common";

/**
 * The one place the app asks "what time is it?". Tests replace this provider
 * with a clock they can move, so deadlines and timeouts are exercised without
 * waiting or patching Date.
 */
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}
