import { Module } from '@nestjs/common';
import { TestSupportResolver } from './test-support.resolver';
import { TestSupportService } from './test-support.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [TestSupportResolver, TestSupportService],
})
export class TestSupportModule {}
