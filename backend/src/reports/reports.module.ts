import { Module } from '@nestjs/common'
import { ReportsController } from './reports.controller'
import { ExcelReportService } from './excel-report.service'
import { BanexTransferService } from './banex-transfer.service'
import { BalanceSheetService } from './balance-sheet.service'

@Module({
  controllers: [ReportsController],
  providers: [ExcelReportService, BanexTransferService, BalanceSheetService],
  exports: [ExcelReportService, BanexTransferService, BalanceSheetService],
})
export class ReportsModule {}
