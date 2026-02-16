import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectsService } from './projects.service';

interface ProjectDto {
  name: string;
  description?: string;
  data: Record<string, unknown>;
}

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async list(@Req() req: any) {
    return this.projectsService.listForUser(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Req() req: any, @Body() body: ProjectDto) {
    const project = await this.projectsService.createForUser(
      req.user.userId,
      body,
    );
    return project;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.getForUser(req.user.userId, id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: ProjectDto,
  ) {
    return this.projectsService.updateForUser(req.user.userId, id, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    await this.projectsService.deleteForUser(req.user.userId, id);
    return { success: true };
  }
}
