import { ApiProperty } from "@nestjs/swagger";

export class InspectUrlDto {
  @ApiProperty({
    description: "The public URL to inspect",
    example: "https://example.com",
  })
  url!: string;

  @ApiProperty({
    description: "Optional project ID associated with this inspection",
    required: false,
  })
  projectId?: string;

  @ApiProperty({
    description: "Optional milestone ID associated with this inspection",
    required: false,
  })
  milestoneId?: string;

  @ApiProperty({
    description: "Whether to include a screenshot in the inspection",
    default: true,
    required: false,
  })
  includeScreenshot?: boolean;

  @ApiProperty({
    description: "Whether to extract visible text from the page",
    default: true,
    required: false,
  })
  includeText?: boolean;

  @ApiProperty({
    description: "Whether to run an AI analysis and summary on the results",
    default: true,
    required: false,
  })
  includeAiSummary?: boolean;
}
