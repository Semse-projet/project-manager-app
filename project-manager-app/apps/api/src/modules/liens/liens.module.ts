import { Module } from '@nestjs/common';
import { LiensService } from './liens.service';
import { LiensController } from './liens.controller';
import { LienGridClient } from '../../integrations/liengrid';

@Module({
  controllers: [LiensController],
  providers: [
    LiensService,
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
  exports: [LiensService],
})
export class LiensModule {}
