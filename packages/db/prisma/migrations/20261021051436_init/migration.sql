-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'ORGANIZER', 'JUDGE', 'ADMIN');

-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('CTF', 'ATTACK_DEFENSE', 'HACKATHON', 'ACM', 'POLYGLOT_BATTLE', 'CODE_GOLF', 'BUG_HUNT', 'KNOCKOUT');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'REGISTRATION', 'LIVE', 'PAUSED', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TournamentVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "LanguageCategory" AS ENUM ('SYSTEM', 'PROGRAMMING', 'MARKUP', 'QUERY');

-- CreateEnum
CREATE TYPE "ChallengeKind" AS ENUM ('STATIC', 'DYNAMIC', 'SERVICE');

-- CreateEnum
CREATE TYPE "ChallengeState" AS ENUM ('DRAFT', 'PUBLISHED', 'LOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FlagFormat" AS ENUM ('STATIC', 'REGEX', 'CASE_INSENSITIVE');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('QUEUED', 'COMPILING', 'RUNNING', 'JUDGING', 'ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'RUNTIME_ERROR', 'COMPILE_ERROR', 'TOO_MANY_SUBMISSIONS', 'ERROR');

-- CreateEnum
CREATE TYPE "JudgeRunStatus" AS ENUM ('QUEUED', 'SENT', 'RUNNING', 'FINISHED', 'FAILED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "ScoreEventType" AS ENUM ('FLAG_CAPTURE', 'CHALLENGE_SOLVED', 'PROBLEM_SOLVED', 'SUBMISSION_ACCEPTED', 'SUBMISSION_PENALTY', 'HACKATHON_SCORED', 'ATTACK_CAPTURED', 'SERVICE_PATCHED', 'SERVICE_DOWN', 'SERVICE_KILLED', 'BRACKET_WIN', 'BRACKET_LOSS', 'BRACKET_ADVANCE', 'BONUS', 'PENALTY', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('PROVISIONING', 'RUNNING', 'DEGRADED', 'DOWN', 'KILLED', 'RETIRED');

-- CreateEnum
CREATE TYPE "AttackStatus" AS ENUM ('QUEUED', 'RUNNING', 'CAPTURED', 'FAILED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "JudgingAssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'SCORED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "BracketType" AS ENUM ('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'SCHEDULED', 'LIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('LEADER', 'MEMBER');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('USER', 'TEAM', 'SUBMISSION', 'CHALLENGE', 'MESSAGE');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('CHALLENGE_FILE', 'PROJECT_ARCHIVE', 'AVATAR', 'BANNER', 'WRITEUP_IMAGE');

-- CreateEnum
CREATE TYPE "AssetVisibility" AS ENUM ('PRIVATE', 'TEAM', 'PUBLIC');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TOURNAMENT_START', 'TOURNAMENT_END', 'TEAM_INVITE', 'CHALLENGE_UNLOCK', 'JUDGE_ASSIGNED', 'AWARD', 'MODERATION', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "handle" TEXT,
    "image_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT NOT NULL,

    CONSTRAINT "bans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "reporter_id" TEXT NOT NULL,
    "tournament_id" TEXT,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "clerkOrgId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_invites" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "languages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "LanguageCategory" NOT NULL DEFAULT 'PROGRAMMING',
    "judge0_id" INTEGER NOT NULL,
    "editor_mode" TEXT NOT NULL,
    "extensions" TEXT[],
    "default_stdin" TEXT,
    "template" TEXT,
    "difficulty_weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "time_limit_factor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "memory_limit_factor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "banner_url" TEXT,
    "game_mode" "GameMode" NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "TournamentVisibility" NOT NULL DEFAULT 'PUBLIC',
    "config" JSONB NOT NULL,
    "rules" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "registration_opens_at" TIMESTAMP(3),
    "registration_closes_at" TIMESTAMP(3),
    "max_teams" INTEGER,
    "max_participants" INTEGER,
    "team_size_min" INTEGER NOT NULL DEFAULT 1,
    "team_size_max" INTEGER NOT NULL DEFAULT 5,
    "require_verified_email" BOOLEAN NOT NULL DEFAULT true,
    "join_code" TEXT,
    "prize_pool" INTEGER,
    "currency" TEXT DEFAULT 'USD',
    "freeze_scoreboard_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_languages" (
    "tournament_id" TEXT NOT NULL,
    "language_id" TEXT NOT NULL,

    CONSTRAINT "tournament_languages_pkey" PRIMARY KEY ("tournament_id","language_id")
);

-- CreateTable
CREATE TABLE "tournament_participants" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_in_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),

    CONSTRAINT "tournament_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_teams" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "seed" INTEGER,
    "final_rank" INTEGER,
    "final_score" INTEGER NOT NULL DEFAULT 0,
    "eliminated_at" TIMESTAMP(3),

    CONSTRAINT "tournament_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_rounds" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "frozen" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,

    CONSTRAINT "tournament_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_categories" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "challenge_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "category_id" TEXT,
    "author_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "ChallengeKind" NOT NULL DEFAULT 'STATIC',
    "state" "ChallengeState" NOT NULL DEFAULT 'DRAFT',
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "initial_points" INTEGER NOT NULL DEFAULT 500,
    "min_points" INTEGER NOT NULL DEFAULT 100,
    "decay_per_solve" INTEGER NOT NULL DEFAULT 50,
    "max_solves" INTEGER,
    "solve_count" INTEGER NOT NULL DEFAULT 0,
    "first_blood_claimed" BOOLEAN NOT NULL DEFAULT false,
    "unlocked_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_prerequisites" (
    "challenge_id" TEXT NOT NULL,
    "unlocks_challenge_id" TEXT NOT NULL,

    CONSTRAINT "challenge_prerequisites_pkey" PRIMARY KEY ("challenge_id","unlocks_challenge_id")
);

-- CreateTable
CREATE TABLE "challenge_languages" (
    "challenge_id" TEXT NOT NULL,
    "language_id" TEXT NOT NULL,

    CONSTRAINT "challenge_languages_pkey" PRIMARY KEY ("challenge_id","language_id")
);

-- CreateTable
CREATE TABLE "challenge_files" (
    "id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_hints" (
    "id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "unlocks_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_hints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_solves" (
    "id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "team_id" TEXT,
    "user_id" TEXT,
    "solved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "points_awarded" INTEGER NOT NULL,
    "is_first_blood" BOOLEAN NOT NULL DEFAULT false,
    "duration_ms" INTEGER,

    CONSTRAINT "challenge_solves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problems" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "points" INTEGER NOT NULL DEFAULT 1,
    "time_limit_ms" INTEGER NOT NULL DEFAULT 2000,
    "memory_limit_kb" INTEGER NOT NULL DEFAULT 262144,
    "max_solves" INTEGER,
    "solve_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_languages" (
    "problem_id" TEXT NOT NULL,
    "language_id" TEXT NOT NULL,

    CONSTRAINT "problem_languages_pkey" PRIMARY KEY ("problem_id","language_id")
);

-- CreateTable
CREATE TABLE "problem_test_cases" (
    "id" TEXT NOT NULL,
    "problem_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "input" TEXT NOT NULL,
    "expected_output" TEXT NOT NULL,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "problem_test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "repo_url" TEXT,
    "demo_url" TEXT,
    "writeup" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubrics" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rubrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_criteria" (
    "id" TEXT NOT NULL,
    "rubric_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "max_score" INTEGER NOT NULL DEFAULT 10,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rubric_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "judging_assignments" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "judge_id" TEXT NOT NULL,
    "status" "JudgingAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "blind" BOOLEAN NOT NULL DEFAULT true,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "total_score" DOUBLE PRECISION,
    "feedback" TEXT,

    CONSTRAINT "judging_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_scores" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rubric_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "owner_team_id" TEXT NOT NULL,
    "challenge_id" TEXT,
    "language_id" TEXT,
    "name" TEXT NOT NULL,
    "docker_image" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 8080,
    "status" "ServiceStatus" NOT NULL DEFAULT 'PROVISIONING',
    "checks_passed" INTEGER NOT NULL DEFAULT 0,
    "checks_failed" INTEGER NOT NULL DEFAULT 0,
    "current_flag_id" TEXT,
    "deployed_at" TIMESTAMP(3),
    "last_check_at" TIMESTAMP(3),
    "killed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attacks" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "attacker_team_id" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "status" "AttackStatus" NOT NULL DEFAULT 'QUEUED',
    "captured_flag_id" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "attacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brackets" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BracketType" NOT NULL DEFAULT 'SINGLE_ELIMINATION',
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bracket_matches" (
    "id" TEXT NOT NULL,
    "bracket_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "team_a_id" TEXT,
    "team_b_id" TEXT,
    "score_a" INTEGER NOT NULL DEFAULT 0,
    "score_b" INTEGER NOT NULL DEFAULT 0,
    "winner_id" TEXT,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "language_a" TEXT,
    "language_b" TEXT,

    CONSTRAINT "bracket_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flags" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "format" "FlagFormat" NOT NULL DEFAULT 'STATIC',
    "points" INTEGER NOT NULL DEFAULT 0,
    "is_dynamic" BOOLEAN NOT NULL DEFAULT false,
    "template" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flag_instances" (
    "id" TEXT NOT NULL,
    "flag_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "service_id" TEXT,
    "value" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "rotated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "flag_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flag_submissions" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "flag_id" TEXT NOT NULL,
    "instance_id" TEXT,
    "team_id" TEXT,
    "user_id" TEXT NOT NULL,
    "attemptHash" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flag_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "challenge_id" TEXT,
    "problem_id" TEXT,
    "team_id" TEXT,
    "user_id" TEXT NOT NULL,
    "language_id" TEXT NOT NULL,
    "source_code" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'QUEUED',
    "score" INTEGER NOT NULL DEFAULT 0,
    "verdict" TEXT,
    "time_ms" INTEGER,
    "memory_kb" INTEGER,
    "exit_code" INTEGER,
    "stdout" TEXT,
    "stderr" TEXT,
    "idempotency_key" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "judged_at" TIMESTAMP(3),

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "judge_runs" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT,
    "language_id" TEXT NOT NULL,
    "runner_job_id" TEXT,
    "runner" TEXT NOT NULL DEFAULT 'judge0',
    "status" "JudgeRunStatus" NOT NULL DEFAULT 'QUEUED',
    "cpu_ms" INTEGER,
    "max_memory_kb" INTEGER,
    "exit_code" INTEGER,
    "signal" TEXT,
    "output" TEXT,
    "error_output" TEXT,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "judge_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_test_results" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "test_case_id" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL,
    "time_ms" INTEGER,
    "memory_kb" INTEGER,
    "output" TEXT,

    CONSTRAINT "submission_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_events" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "team_id" TEXT,
    "user_id" TEXT,
    "type" "ScoreEventType" NOT NULL,
    "points" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "delta" INTEGER NOT NULL,
    "ref_type" TEXT,
    "ref_id" TEXT,
    "metadata" JSONB,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_snapshots" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "team_id" TEXT,
    "user_id" TEXT,
    "rank" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "solves" INTEGER NOT NULL DEFAULT 0,
    "penalty" INTEGER NOT NULL DEFAULT 0,
    "last_event_at" TIMESTAMP(3),
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'general',
    "body" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "metadata" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "owner_id" TEXT NOT NULL,
    "project_id" TEXT,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prizes" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "amount" INTEGER,
    "currency" TEXT DEFAULT 'USD',
    "description" TEXT,
    "awarded_team_id" TEXT,

    CONSTRAINT "prizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_events" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "bans_user_id_idx" ON "bans"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_target_type_target_id_idx" ON "reports"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "reports_tournament_id_idx" ON "reports"("tournament_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_clerkOrgId_key" ON "organizations"("clerkOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "teams_name_idx" ON "teams"("name");

-- CreateIndex
CREATE UNIQUE INDEX "teams_owner_id_slug_key" ON "teams"("owner_id", "slug");

-- CreateIndex
CREATE INDEX "team_members_user_id_idx" ON "team_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_user_id_key" ON "team_members"("team_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_invites_token_key" ON "team_invites"("token");

-- CreateIndex
CREATE INDEX "team_invites_receiver_id_idx" ON "team_invites"("receiver_id");

-- CreateIndex
CREATE UNIQUE INDEX "languages_slug_key" ON "languages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_join_code_key" ON "tournaments"("join_code");

-- CreateIndex
CREATE INDEX "tournaments_status_starts_at_idx" ON "tournaments"("status", "starts_at");

-- CreateIndex
CREATE INDEX "tournaments_game_mode_idx" ON "tournaments"("game_mode");

-- CreateIndex
CREATE INDEX "tournaments_organization_id_idx" ON "tournaments"("organization_id");

-- CreateIndex
CREATE INDEX "tournament_languages_language_id_idx" ON "tournament_languages"("language_id");

-- CreateIndex
CREATE INDEX "tournament_participants_team_id_idx" ON "tournament_participants"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_participants_tournament_id_user_id_key" ON "tournament_participants"("tournament_id", "user_id");

-- CreateIndex
CREATE INDEX "tournament_teams_team_id_idx" ON "tournament_teams"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_teams_tournament_id_team_id_key" ON "tournament_teams"("tournament_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_rounds_tournament_id_order_key" ON "tournament_rounds"("tournament_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_categories_tournament_id_slug_key" ON "challenge_categories"("tournament_id", "slug");

-- CreateIndex
CREATE INDEX "challenges_category_id_idx" ON "challenges"("category_id");

-- CreateIndex
CREATE INDEX "challenges_state_idx" ON "challenges"("state");

-- CreateIndex
CREATE UNIQUE INDEX "challenges_tournament_id_slug_key" ON "challenges"("tournament_id", "slug");

-- CreateIndex
CREATE INDEX "challenge_languages_language_id_idx" ON "challenge_languages"("language_id");

-- CreateIndex
CREATE INDEX "challenge_files_challenge_id_idx" ON "challenge_files"("challenge_id");

-- CreateIndex
CREATE INDEX "challenge_hints_challenge_id_idx" ON "challenge_hints"("challenge_id");

-- CreateIndex
CREATE INDEX "challenge_solves_challenge_id_solved_at_idx" ON "challenge_solves"("challenge_id", "solved_at");

-- CreateIndex
CREATE INDEX "challenge_solves_team_id_idx" ON "challenge_solves"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "problems_tournament_id_slug_key" ON "problems"("tournament_id", "slug");

-- CreateIndex
CREATE INDEX "problem_languages_language_id_idx" ON "problem_languages"("language_id");

-- CreateIndex
CREATE UNIQUE INDEX "problem_test_cases_problem_id_order_key" ON "problem_test_cases"("problem_id", "order");

-- CreateIndex
CREATE INDEX "projects_tournament_id_status_idx" ON "projects"("tournament_id", "status");

-- CreateIndex
CREATE INDEX "projects_team_id_idx" ON "projects"("team_id");

-- CreateIndex
CREATE INDEX "rubrics_tournament_id_idx" ON "rubrics"("tournament_id");

-- CreateIndex
CREATE INDEX "rubric_criteria_rubric_id_idx" ON "rubric_criteria"("rubric_id");

-- CreateIndex
CREATE INDEX "judging_assignments_judge_id_status_idx" ON "judging_assignments"("judge_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "judging_assignments_project_id_judge_id_key" ON "judging_assignments"("project_id", "judge_id");

-- CreateIndex
CREATE INDEX "rubric_scores_criterion_id_idx" ON "rubric_scores"("criterion_id");

-- CreateIndex
CREATE UNIQUE INDEX "rubric_scores_assignment_id_criterion_id_key" ON "rubric_scores"("assignment_id", "criterion_id");

-- CreateIndex
CREATE INDEX "services_tournament_id_status_idx" ON "services"("tournament_id", "status");

-- CreateIndex
CREATE INDEX "services_owner_team_id_idx" ON "services"("owner_team_id");

-- CreateIndex
CREATE INDEX "attacks_tournament_id_created_at_idx" ON "attacks"("tournament_id", "created_at");

-- CreateIndex
CREATE INDEX "attacks_attacker_team_id_idx" ON "attacks"("attacker_team_id");

-- CreateIndex
CREATE INDEX "brackets_tournament_id_idx" ON "brackets"("tournament_id");

-- CreateIndex
CREATE INDEX "bracket_matches_team_a_id_idx" ON "bracket_matches"("team_a_id");

-- CreateIndex
CREATE INDEX "bracket_matches_team_b_id_idx" ON "bracket_matches"("team_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "bracket_matches_bracket_id_round_position_key" ON "bracket_matches"("bracket_id", "round", "position");

-- CreateIndex
CREATE INDEX "flags_challenge_id_idx" ON "flags"("challenge_id");

-- CreateIndex
CREATE INDEX "flags_tournament_id_idx" ON "flags"("tournament_id");

-- CreateIndex
CREATE INDEX "flag_instances_team_id_idx" ON "flag_instances"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "flag_instances_flag_id_team_id_key" ON "flag_instances"("flag_id", "team_id");

-- CreateIndex
CREATE INDEX "flag_submissions_tournament_id_created_at_idx" ON "flag_submissions"("tournament_id", "created_at");

-- CreateIndex
CREATE INDEX "flag_submissions_team_id_correct_idx" ON "flag_submissions"("team_id", "correct");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_idempotency_key_key" ON "submissions"("idempotency_key");

-- CreateIndex
CREATE INDEX "submissions_tournament_id_submitted_at_idx" ON "submissions"("tournament_id", "submitted_at");

-- CreateIndex
CREATE INDEX "submissions_team_id_idx" ON "submissions"("team_id");

-- CreateIndex
CREATE INDEX "submissions_problem_id_status_idx" ON "submissions"("problem_id", "status");

-- CreateIndex
CREATE INDEX "submissions_challenge_id_idx" ON "submissions"("challenge_id");

-- CreateIndex
CREATE UNIQUE INDEX "judge_runs_submission_id_key" ON "judge_runs"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "judge_runs_runner_job_id_key" ON "judge_runs"("runner_job_id");

-- CreateIndex
CREATE INDEX "judge_runs_status_queued_at_idx" ON "judge_runs"("status", "queued_at");

-- CreateIndex
CREATE INDEX "submission_test_results_test_case_id_idx" ON "submission_test_results"("test_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "submission_test_results_submission_id_test_case_id_key" ON "submission_test_results"("submission_id", "test_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "score_events_idempotency_key_key" ON "score_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "score_events_tournament_id_created_at_idx" ON "score_events"("tournament_id", "created_at");

-- CreateIndex
CREATE INDEX "score_events_tournament_id_team_id_idx" ON "score_events"("tournament_id", "team_id");

-- CreateIndex
CREATE INDEX "score_events_ref_type_ref_id_idx" ON "score_events"("ref_type", "ref_id");

-- CreateIndex
CREATE INDEX "score_snapshots_tournament_id_rank_idx" ON "score_snapshots"("tournament_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "score_snapshots_tournament_id_team_id_key" ON "score_snapshots"("tournament_id", "team_id");

-- CreateIndex
CREATE INDEX "announcements_tournament_id_created_at_idx" ON "announcements"("tournament_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_tournament_id_channel_created_at_idx" ON "chat_messages"("tournament_id", "channel", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "assets_key_key" ON "assets"("key");

-- CreateIndex
CREATE INDEX "assets_project_id_idx" ON "assets"("project_id");

-- CreateIndex
CREATE INDEX "prizes_tournament_id_idx" ON "prizes"("tournament_id");

-- CreateIndex
CREATE INDEX "game_events_tournament_id_created_at_idx" ON "game_events"("tournament_id", "created_at");

-- AddForeignKey
ALTER TABLE "bans" ADD CONSTRAINT "bans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bans" ADD CONSTRAINT "bans_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_languages" ADD CONSTRAINT "tournament_languages_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_languages" ADD CONSTRAINT "tournament_languages_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_rounds" ADD CONSTRAINT "tournament_rounds_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_categories" ADD CONSTRAINT "challenge_categories_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "challenge_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_prerequisites" ADD CONSTRAINT "challenge_prerequisites_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_prerequisites" ADD CONSTRAINT "challenge_prerequisites_unlocks_challenge_id_fkey" FOREIGN KEY ("unlocks_challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_languages" ADD CONSTRAINT "challenge_languages_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_languages" ADD CONSTRAINT "challenge_languages_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_files" ADD CONSTRAINT "challenge_files_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_hints" ADD CONSTRAINT "challenge_hints_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_hints" ADD CONSTRAINT "challenge_hints_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_solves" ADD CONSTRAINT "challenge_solves_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_solves" ADD CONSTRAINT "challenge_solves_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_languages" ADD CONSTRAINT "problem_languages_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_languages" ADD CONSTRAINT "problem_languages_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_test_cases" ADD CONSTRAINT "problem_test_cases_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubrics" ADD CONSTRAINT "rubrics_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_criteria" ADD CONSTRAINT "rubric_criteria_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "rubrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "judging_assignments" ADD CONSTRAINT "judging_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "judging_assignments" ADD CONSTRAINT "judging_assignments_judge_id_fkey" FOREIGN KEY ("judge_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_scores" ADD CONSTRAINT "rubric_scores_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "judging_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_scores" ADD CONSTRAINT "rubric_scores_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "rubric_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_owner_team_id_fkey" FOREIGN KEY ("owner_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_current_flag_id_fkey" FOREIGN KEY ("current_flag_id") REFERENCES "flags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attacks" ADD CONSTRAINT "attacks_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attacks" ADD CONSTRAINT "attacks_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attacks" ADD CONSTRAINT "attacks_attacker_team_id_fkey" FOREIGN KEY ("attacker_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brackets" ADD CONSTRAINT "brackets_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_bracket_id_fkey" FOREIGN KEY ("bracket_id") REFERENCES "brackets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_team_a_id_fkey" FOREIGN KEY ("team_a_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_team_b_id_fkey" FOREIGN KEY ("team_b_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flags" ADD CONSTRAINT "flags_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flags" ADD CONSTRAINT "flags_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_instances" ADD CONSTRAINT "flag_instances_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_instances" ADD CONSTRAINT "flag_instances_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_instances" ADD CONSTRAINT "flag_instances_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_submissions" ADD CONSTRAINT "flag_submissions_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_submissions" ADD CONSTRAINT "flag_submissions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_submissions" ADD CONSTRAINT "flag_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "judge_runs" ADD CONSTRAINT "judge_runs_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "judge_runs" ADD CONSTRAINT "judge_runs_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_test_results" ADD CONSTRAINT "submission_test_results_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_test_results" ADD CONSTRAINT "submission_test_results_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "problem_test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prizes" ADD CONSTRAINT "prizes_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
