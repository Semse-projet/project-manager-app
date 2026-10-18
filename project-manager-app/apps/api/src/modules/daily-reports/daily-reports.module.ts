import { Module } from "@nestjs/common";
import { CrewDailyReportsController, DailyReportReviewController } from "./daily-reports.controller.js";
import { DailyReportsService } from "./daily-reports.service.js";

@Module({
  controllers: [CrewDailyReportsController, DailyReportReviewController],
  providers: [DailyReportsService]
})
export class DailyReportsModule {}
