import { Module } from '@nestjs/common';
import { LiensService } from './liens.service';
import { LiensController } from './liens.controller';
import { ProjectLiensService } from './project-liens.service';
import { LienAlertsScheduler } from './lien-alerts.scheduler';
import { LienSchedulerController } from './lien-scheduler.controller';
import { NoticeGeneratorService } from './notice-generator.service';
import { NoticeController } from './notice.controller';
import { LienGridClient } from '../../integrations/liengrid';

@Module({
  controllers: [LiensController, LienSchedulerController, NoticeController],
  providers: [
    LiensService,
    ProjectLiensService,
    LienAlertsScheduler,
    NoticeGeneratorService,
    {
      provide: LienGridClient,
      useFactory: () => {
        // Usar mock si LIENGRID_API_KEY no está configurada
        const useMock = !process.env.LIENGRID_API_KEY;
        if (useMock) {
          console.log('[Liens] Using Mock LienGridClient (LIENGRID_API_KEY not set)');
          return require('../../integrations/liengrid').createLienGridClient('', true);
        }
        return new LienGridClient();
      },
    },
  ],
  exports: [LiensService, ProjectLiensService, LienAlertsScheduler, NoticeGeneratorService],
})
export class LiensModule {}
