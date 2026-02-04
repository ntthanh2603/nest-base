import { Test, TestingModule } from '@nestjs/testing';
import { AbcService } from './abc.service';

describe('AbcService', () => {
  let service: AbcService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AbcService],
    }).compile();

    service = module.get<AbcService>(AbcService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
