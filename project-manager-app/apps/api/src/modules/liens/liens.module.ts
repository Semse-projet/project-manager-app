import { Module } from '@nestjs/common';
import { LiensService } from './liens.service.js';
import { LiensController } from './liens.controller.js';
import { ProjectLiensService } from './project-liens.service.js';
import { LienAlertsScheduler } from './lien-alerts.scheduler.js';
import { LienSchedulerController } from './lien-scheduler.controller.js';
import { NoticeGeneratorService } from './notice-generator.service.js';
import { NoticeSendService } from './notice-send.service.js';
import { NoticeController } from './notice.controller.js';
import { WaiverController } from './waiver.controller.js';
import { LienGridClient, createLienGridClient } from '../../integrations/liengrid.js';
import { LobClient, createLobClient } from '../../integrations/lob.js';

@Module({
  controllers: [LiensController, LienSchedulerController, NoticeController, WaiverController],
  providers: [
    LiensService,
    ProjectLiensService,
    LienAlertsScheduler,
    NoticeGeneratorService,
    NoticeSendService,
    {
      provide: LienGridClient,
      useFactory: () => {
        // Usar mock si LIENGRID_API_KEY no está configurada
        const useMock = !process.env.LIENGRID_API_KEY;
        if (useMock) {
          console.log('[Liens] Using Mock LienGridClient (LIENGRID_API_KEY not set)');
          return createLienGridClient('', true);
        }
        return new LienGridClient();
      },
    },
    {
      provide: LobClient,
      useFactory: () => {
        // Usar mock si LOB_API_KEY no está configurada — nunca mandar
        // correo certificado real sin una API key explícita.
        const useMock = !process.env.LOB_API_KEY;
        if (useMock) {
          console.log('[Liens] Using Mock LobClient (LOB_API_KEY not set)');
          return createLobClient('', true);
        }
        return new LobClient();
      },
    },
  ],
  exports: [LiensService, ProjectLiensService, LienAlertsScheduler, NoticeGeneratorService, NoticeSendService],
})
export class LiensModule {}
