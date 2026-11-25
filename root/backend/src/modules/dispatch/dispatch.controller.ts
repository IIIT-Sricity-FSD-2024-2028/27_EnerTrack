import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { Body, Controller, Get, Headers, Param, Post, Put } from "@nestjs/common";
import { Roles } from "../../core/decorators/roles.decorator";
import { DispatchService } from "./dispatch.service";
import { SlaService } from "./sla.service";
import { AvailabilityDto, DeclineJobDto, DecideDto, DecideReworkDto, ExtensionRequestDto, FinishJobDto, ManualAssignDto, NeedsPartsDto, SendFaultDto, SetDeadlineDto } from "./dto/dispatch.dto";

/**
 * Technicians never browse or pick jobs. The system pushes each job to one
 * person; they can only acknowledge it, decline it with a reason, or switch
 * their own availability. Coordinators see what the system could not place.
 */
@ApiTags("dispatch")
@Controller("dispatch")
export class DispatchController {
  constructor(
    private readonly dispatch: DispatchService,
    private readonly sla: SlaService,
  ) {}

  @Get("mine")
  @ApiOperation({ summary: "My dispatched jobs", description: "Jobs the system gave to the signed-in technician, newest first." })
  @ApiResponse({ status: 200, description: "Array of jobs." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Technician")
  mine(@Headers("x-user-id") userId: string) {
    return this.dispatch.mine(userId).reverse();
  }

  @Get("availability")
  @ApiOperation({ summary: "My availability and load" })
  @Roles("Technician")
  availability(@Headers("x-user-id") userId: string) {
    return this.dispatch.availabilityFor(userId);
  }

  @Put("availability")
  @ApiOperation({ summary: "Switch 'Available today' on or off", description: "Off means the system will not send new jobs. Turning it on may place jobs that were waiting." })
  @Roles("Technician")
  setAvailability(@Headers("x-user-id") userId: string, @Body() dto: AvailabilityDto) {
    return this.dispatch.setAvailability(userId, dto.available);
  }

  @Post("work-orders/:id/acknowledge")
  @ApiOperation({ summary: "Acknowledge a job" })
  @Roles("Technician")
  acknowledge(@Headers("x-user-id") userId: string, @Param("id") id: string) {
    return this.dispatch.acknowledge(userId, id);
  }

  @Post("work-orders/:id/decline")
  @ApiOperation({ summary: "Decline a job with a reason", description: "The job moves to the next ranked person. 'sick' also marks you unavailable for the day." })
  @Roles("Technician")
  decline(@Headers("x-user-id") userId: string, @Param("id") id: string, @Body() dto: DeclineJobDto) {
    return this.dispatch.decline(userId, id, dto.reason);
  }

  @Post("work-orders/:id/start")
  @ApiOperation({ summary: "Start the job", description: "After acknowledging. The student's ticket moves to Visited." })
  @Roles("Technician")
  start(@Headers("x-user-id") userId: string, @Param("id") id: string) {
    return this.dispatch.start(userId, id);
  }

  @Post("work-orders/:id/finish")
  @ApiOperation({ summary: "Mark the work done", description: "Goes to the coordinator to verify and close. Closing is what marks the student's ticket Fixed." })
  @Roles("Technician")
  finish(@Headers("x-user-id") userId: string, @Param("id") id: string, @Body() dto: FinishJobDto) {
    return this.dispatch.finish(userId, id, dto?.notes);
  }

  @Post("faults/:id/send")
  @ApiOperation({ summary: "Send a fault to a technician", description: "Turns a monitoring fault into a job and sends it through the same ranking, acknowledge window and deadline as a student report. Pass assignee_id to pick the person yourself." })
  @Roles("Operations Coordinator", "Organization Admin")
  sendFault(@Param("id") id: string, @Body() dto: SendFaultDto) {
    return this.dispatch.sendFault(id, { kind: dto.kind, priority: dto.priority, assigneeId: dto.assignee_id, notes: dto.notes });
  }

  @Get("queue")
  @ApiOperation({ summary: "Coordinator exception queue", description: "Tickets the system could not place, who declines a lot, and team availability." })
  @Roles("Operations Coordinator", "Organization Admin")
  queue() {
    return this.dispatch.queue();
  }

  @Post("tickets/:id/assign")
  @ApiOperation({ summary: "Hand-pick a technician for a ticket", description: "Always allowed for the coordinator, including reassigning." })
  @Roles("Operations Coordinator", "Organization Admin")
  assign(@Param("id") id: string, @Body() dto: ManualAssignDto) {
    return this.dispatch.manualAssign(id, dto.user_id);
  }

  @Post("rework-requests/:ticketId")
  @ApiOperation({
    summary: "Decide a rework request on an initiative job",
    description:
      "The Sustainability Officer asked for a closed initiative job to be redone. decision: same (the technician who did it), auto (the system picks), pick (assignee_id), each with finish_by (YYYY-MM-DD, today or later); or decline with a note (sent to the officer). Pending requests are listed in GET /dispatch/queue as rework_requests.",
  })
  @ApiResponse({ status: 201, description: "Decision recorded; a rework job was sent unless declined." })
  @ApiResponse({ status: 400, description: "No request waiting, bad decision, date or note." })
  @Roles("Operations Coordinator", "Organization Admin")
  decideRework(@Param("ticketId") ticketId: string, @Body() dto: DecideReworkDto, @Headers("x-user-id") userId: string) {
    return this.dispatch.decideRework(ticketId, dto, userId);
  }

  @Post("technicians/:userId/back-on-duty")
  @ApiOperation({
    summary: "Put a technician back on duty",
    description:
      "Clears 'off for today' (declined a job as unwell by mistake, or missed answering one) and switches them available, so jobs can be sent to them again today. Waiting jobs are offered again. The technician is told.",
  })
  @Roles("Operations Coordinator", "Organization Admin")
  backOnDuty(@Param("userId") userId: string, @Headers("x-user-id") coordinatorId: string) {
    return this.dispatch.backOnDuty(userId, coordinatorId);
  }

  @Post("sweep")
  @ApiOperation({ summary: "Run the timeout check now", description: "Normally runs every minute on its own." })
  @Roles("Operations Coordinator", "Organization Admin")
  sweep() {
    return this.dispatch.sweep();
  }

  // ── Deadlines ──────────────────────────────────────────────────────────

  @Post("work-orders/:id/needs-parts")
  @ApiOperation({ summary: "Pause the clock while waiting for parts", description: "Default 2 days. Over 5 days is sent to the coordinator for approval and the clock keeps running until they agree." })
  @Roles("Technician")
  needsParts(@Headers("x-user-id") userId: string, @Param("id") id: string, @Body() dto: NeedsPartsDto) {
    return this.sla.needsParts(userId, id, dto.days);
  }

  @Post("work-orders/:id/resume")
  @ApiOperation({ summary: "Parts arrived: start the clock again" })
  @Roles("Technician")
  resume(@Headers("x-user-id") userId: string, @Param("id") id: string) {
    return this.sla.resume(userId, id);
  }

  @Post("work-orders/:id/made-safe")
  @ApiOperation({ summary: "Critical job: the danger has been made safe" })
  @Roles("Technician")
  madeSafe(@Headers("x-user-id") userId: string, @Param("id") id: string) {
    return this.sla.madeSafe(userId, id);
  }

  @Post("work-orders/:id/extension")
  @ApiOperation({ summary: "Ask for more time", description: "A new date and a short reason. The clock keeps running until the coordinator agrees; if they do not answer in time the original date stands." })
  @Roles("Technician")
  requestExtension(@Headers("x-user-id") userId: string, @Param("id") id: string, @Body() dto: ExtensionRequestDto) {
    return this.sla.requestExtension(userId, id, dto.new_deadline_at, dto.reason);
  }

  @Post("work-orders/:id/extension/decide")
  @ApiOperation({ summary: "Approve or refuse a request for more time or a long parts wait" })
  @Roles("Operations Coordinator", "Organization Admin")
  decide(@Param("id") id: string, @Body() dto: DecideDto) {
    return this.sla.decide(id, dto.approve);
  }

  @Put("work-orders/:id/deadline")
  @ApiOperation({ summary: "Set a job's finish date", description: "The coordinator can change any job's deadline." })
  @Roles("Operations Coordinator", "Organization Admin")
  setDeadline(@Param("id") id: string, @Body() dto: SetDeadlineDto) {
    return this.sla.setDeadline(id, dto.deadline_at);
  }
}
