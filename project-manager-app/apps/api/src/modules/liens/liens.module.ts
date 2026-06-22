import { Module } from '@nestjs/common';
import { LiensService } from './liens.service.js';
import { LiensController } from './liens.controller.js';
import { ProjectLiensService } from './project-liens.service.js';
import { LienAlertsScheduler } from './lien-alerts.scheduler.js';
import { LienSchedulerController } from './lien-scheduler.controller.js';
import { NoticeGeneratorService } from './notice-generator.service.js';
import { NoticeController } from './notice.controller.js';
import { LienGridClient } from '../../integrations/liengrid.js';

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
