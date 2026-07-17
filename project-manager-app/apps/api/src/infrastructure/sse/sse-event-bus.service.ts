import { Injectable } from "@nestjs/common";
import { Observable, Subject } from "rxjs";
import {filter} from "rxjs/operators";

export type SseEvent<T = unknown> = {
  channel: string;
  event: string;
  data: T;
};

@Injectable()
export class SseEventBusService {
  private readonly bus = new Subject<SseEvent>();

  emit<T>(channel: string, event: string, data: T): void {
    this.bus.next({ channel, event, data });
  }

  on<T>(channel: string): Observable<SseEvent<T>> {
    return this.bus.pipe(
      filter(e => e.channel === channel),
    ) as Observable<SseEvent<T>>;
  }

  onPrefix<T>(prefix: string): Observable<SseEvent<T>> {
    return this.bus.pipe(
      filter(e => e.channel.startsWith(prefix)),
    ) as Observable<SseEvent<T>>;
  }
}
