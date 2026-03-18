--
-- PostgreSQL database dump
--

\restrict FtoDTfxZDQOn9dIQvqVPZOjG5EvdD0PGWnpJa53LNwyjs7fs0wrdvJ9WY4kagSF

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: entry_mode; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.entry_mode AS ENUM (
    'staffed',
    'unmanned',
    'hybrid'
);


ALTER TYPE public.entry_mode OWNER TO postgres;

--
-- Name: invitation_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.invitation_status AS ENUM (
    'pending',
    'accepted',
    'expired',
    'revoked'
);


ALTER TYPE public.invitation_status OWNER TO postgres;

--
-- Name: org_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.org_status AS ENUM (
    'active',
    'suspended',
    'pending_setup',
    'deactivated'
);


ALTER TYPE public.org_status OWNER TO postgres;

--
-- Name: org_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.org_type AS ENUM (
    'government',
    'enterprise',
    'smb'
);


ALTER TYPE public.org_type OWNER TO postgres;

--
-- Name: subscription_tier; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.subscription_tier AS ENUM (
    'starter',
    'professional',
    'enterprise',
    'government'
);


ALTER TYPE public.subscription_tier OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'super_admin',
    'org_admin',
    'visitor_manager',
    'receptionist',
    'host_employee'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: verification_policy; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.verification_policy AS ENUM (
    'none',
    'otp_only',
    'nafath_only',
    'otp_or_nafath',
    'nafath_required_otp_fallback'
);


ALTER TYPE public.verification_policy OWNER TO postgres;

--
-- Name: visit_request_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.visit_request_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'checked_in',
    'checked_out',
    'expired',
    'cancelled'
);


ALTER TYPE public.visit_request_status OWNER TO postgres;

--
-- Name: visit_request_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.visit_request_type AS ENUM (
    'pre_registered',
    'walk_in'
);


ALTER TYPE public.visit_request_type OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    org_id text,
    user_id text,
    user_name text,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    details jsonb,
    ip_address text,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: blacklist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blacklist (
    id text NOT NULL,
    org_id text NOT NULL,
    visitor_id text NOT NULL,
    reason text NOT NULL,
    blacklisted_by_id text NOT NULL,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.blacklist OWNER TO postgres;

--
-- Name: branches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.branches (
    id text NOT NULL,
    org_id text NOT NULL,
    name text NOT NULL,
    name_ar text,
    address text,
    city text,
    branch_code text NOT NULL,
    entry_mode public.entry_mode DEFAULT 'staffed'::public.entry_mode NOT NULL,
    verification_policy_override text,
    is_active boolean DEFAULT true NOT NULL,
    max_concurrent_visitors integer,
    working_hours_override jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.branches OWNER TO postgres;

--
-- Name: invitations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invitations (
    id text NOT NULL,
    org_id text NOT NULL,
    branch_id text,
    invited_by_id text NOT NULL,
    email text NOT NULL,
    phone text,
    name text NOT NULL,
    name_ar text,
    role text NOT NULL,
    department text,
    job_title text,
    invitation_token text NOT NULL,
    token_expires_at timestamp without time zone NOT NULL,
    status public.invitation_status DEFAULT 'pending'::public.invitation_status NOT NULL,
    sent_at timestamp without time zone DEFAULT now() NOT NULL,
    accepted_at timestamp without time zone,
    revoked_at timestamp without time zone,
    revoked_by_id text,
    resend_count integer DEFAULT 0 NOT NULL,
    last_resent_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invitations OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    user_id text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    related_entity_type text,
    related_entity_id text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id text NOT NULL,
    name text NOT NULL,
    name_ar text,
    logo text,
    address text,
    type public.org_type NOT NULL,
    subscription_tier public.subscription_tier DEFAULT 'starter'::public.subscription_tier NOT NULL,
    public_booking_slug text,
    status public.org_status DEFAULT 'pending_setup'::public.org_status NOT NULL,
    verification_policy public.verification_policy DEFAULT 'none'::public.verification_policy NOT NULL,
    nafath_enabled boolean DEFAULT false NOT NULL,
    otp_enabled boolean DEFAULT true NOT NULL,
    verification_bypass_for_trusted boolean DEFAULT false NOT NULL,
    max_users integer DEFAULT 20 NOT NULL,
    max_branches integer DEFAULT 5 NOT NULL,
    telegram_chat_id text,
    primary_contact_name text,
    primary_contact_email text,
    primary_contact_phone text,
    contract_start_date text,
    contract_end_date text,
    suspension_reason text,
    setup_wizard_completed boolean DEFAULT false NOT NULL,
    settings jsonb,
    created_by_id text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    activated_at timestamp without time zone,
    suspended_at timestamp without time zone,
    deactivated_at timestamp without time zone
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: otp_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.otp_sessions (
    id text NOT NULL,
    phone text,
    email text,
    otp text NOT NULL,
    channel text DEFAULT 'sms'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.otp_sessions OWNER TO postgres;

--
-- Name: telegram_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.telegram_subscriptions (
    id text NOT NULL,
    user_id text NOT NULL,
    org_id text,
    chat_id text NOT NULL,
    username text,
    first_name text,
    notify_approvals boolean DEFAULT true NOT NULL,
    notify_check_ins boolean DEFAULT true NOT NULL,
    notify_walk_ins boolean DEFAULT true NOT NULL,
    notify_rejections boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    linked_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.telegram_subscriptions OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    org_id text,
    branch_id text,
    name text NOT NULL,
    name_ar text,
    email text NOT NULL,
    phone text,
    national_id text,
    role public.user_role NOT NULL,
    department text,
    job_title text,
    is_active boolean DEFAULT true NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    lock_reason text,
    invited_by_id text,
    invitation_accepted_at timestamp without time zone,
    telegram_user_id text,
    telegram_linked_at timestamp without time zone,
    last_login_at timestamp without time zone,
    last_active_at timestamp without time zone,
    login_count integer DEFAULT 0 NOT NULL,
    password_hash text NOT NULL,
    password_changed_at timestamp without time zone,
    must_change_password boolean DEFAULT false NOT NULL,
    two_factor_enabled boolean DEFAULT false NOT NULL,
    two_factor_method text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp without time zone,
    deactivated_by_id text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: visit_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.visit_requests (
    id text NOT NULL,
    org_id text NOT NULL,
    branch_id text NOT NULL,
    visitor_id text NOT NULL,
    host_user_id text,
    purpose text NOT NULL,
    purpose_ar text,
    type public.visit_request_type DEFAULT 'walk_in'::public.visit_request_type NOT NULL,
    status public.visit_request_status DEFAULT 'pending'::public.visit_request_status NOT NULL,
    scheduled_date text NOT NULL,
    scheduled_time_from text,
    scheduled_time_to text,
    qr_code text,
    qr_expires_at timestamp without time zone,
    tracking_token text,
    check_in_time timestamp without time zone,
    check_out_time timestamp without time zone,
    checked_in_by_id text,
    approval_method text,
    approved_by_id text,
    approved_at timestamp without time zone,
    rejection_reason text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.visit_requests OWNER TO postgres;

--
-- Name: visitors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.visitors (
    id text NOT NULL,
    national_id_number text,
    full_name text NOT NULL,
    full_name_ar text,
    phone text,
    email text,
    company_name text,
    photo_url text,
    is_blacklisted boolean DEFAULT false NOT NULL,
    blacklist_reason text,
    verification_status text DEFAULT 'pending'::text NOT NULL,
    nafath_verified_at timestamp without time zone,
    nafath_transaction_id text,
    nafath_confidence_level text,
    otp_verified_at timestamp without time zone,
    otp_phone_used text,
    last_verification_method text,
    last_verified_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.visitors OWNER TO postgres;

--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, org_id, user_id, user_name, action, entity_type, entity_id, details, ip_address, "timestamp") FROM stdin;
audit001	org001	vm001	Sara Al-Dosari	APPROVE_VISIT_REQUEST	visit_request	req001	{"method": "web"}	192.168.1.100	2026-03-16 21:08:26.34465
audit002	org001	recept001	Khalid Al-Mansouri	CHECK_IN	visit_request	req001	{"visitor": "Abdullah Al-Otaibi"}	192.168.1.101	2026-03-16 22:08:26.34465
audit003	org001	orgadmin001	Ahmed Al-Rashid	CREATE_BRANCH	branch	branch002	{"branch_code": "JED-01"}	192.168.1.102	2026-03-09 23:08:26.34465
audit004	org001	orgadmin001	Ahmed Al-Rashid	INVITE_USER	invitation	inv001	{"role": "visitor_manager", "email": "vm@moi.gov.sa"}	192.168.1.102	2026-03-02 23:08:26.34465
\.


--
-- Data for Name: blacklist; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.blacklist (id, org_id, visitor_id, reason, blacklisted_by_id, expires_at, created_at) FROM stdin;
58fa5bca2dbedcdee59a4645	org001	visitor005	Unauthorized entry attempt on previous visit	vm001	\N	2026-03-16 23:08:14.460979
\.


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.branches (id, org_id, name, name_ar, address, city, branch_code, entry_mode, verification_policy_override, is_active, max_concurrent_visitors, working_hours_override, created_at, updated_at) FROM stdin;
branch001	org001	Riyadh HQ	المقر الرئيسي - الرياض	King Fahd Road, Riyadh	Riyadh	RUH-HQ	staffed	\N	t	\N	\N	2026-03-16 23:07:14.961087	2026-03-16 23:07:14.961087
branch002	org001	Jeddah Branch	فرع جدة	Corniche Road, Jeddah	Jeddah	JED-01	staffed	\N	t	\N	\N	2026-03-16 23:07:14.961087	2026-03-16 23:07:14.961087
\.


--
-- Data for Name: invitations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invitations (id, org_id, branch_id, invited_by_id, email, phone, name, name_ar, role, department, job_title, invitation_token, token_expires_at, status, sent_at, accepted_at, revoked_at, revoked_by_id, resend_count, last_resent_at, created_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, type, title, message, is_read, related_entity_type, related_entity_id, created_at) FROM stdin;
notif001	host001	visitor_arrived	Visitor Arrived	Abdullah Al-Otaibi has checked in at Riyadh HQ	f	visit_request	req001	2026-03-16 22:08:22.591212
notif002	vm001	new_request	New Visit Request	Walk-in request from Omar Hassan is pending approval	f	visit_request	req003	2026-03-16 18:08:22.591212
notif003	vm001	new_request	New Walk-in Request	Layla Al-Rashid submitted a walk-in request for tomorrow	t	visit_request	req004	2026-03-15 23:08:22.591212
notif004	orgadmin001	system	Setup Complete	Your organization has been set up successfully	t	organization	org001	2026-03-09 23:08:22.591212
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organizations (id, name, name_ar, logo, address, type, subscription_tier, public_booking_slug, status, verification_policy, nafath_enabled, otp_enabled, verification_bypass_for_trusted, max_users, max_branches, telegram_chat_id, primary_contact_name, primary_contact_email, primary_contact_phone, contract_start_date, contract_end_date, suspension_reason, setup_wizard_completed, settings, created_by_id, created_at, updated_at, activated_at, suspended_at, deactivated_at) FROM stdin;
org001	Ministry of Interior	وزارة الداخلية	\N	\N	government	government	ministry-of-interior	active	otp_or_nafath	t	t	f	50	10	\N	Ahmed Al-Rashid	admin@moi.gov.sa	\N	\N	\N	\N	t	\N	\N	2026-03-16 23:07:11.076259	2026-03-16 23:07:11.076259	\N	\N	\N
\.


--
-- Data for Name: otp_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.otp_sessions (id, phone, email, otp, channel, attempts, verified, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: telegram_subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.telegram_subscriptions (id, user_id, org_id, chat_id, username, first_name, notify_approvals, notify_check_ins, notify_walk_ins, notify_rejections, is_active, linked_at, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, org_id, branch_id, name, name_ar, email, phone, national_id, role, department, job_title, is_active, is_locked, lock_reason, invited_by_id, invitation_accepted_at, telegram_user_id, telegram_linked_at, last_login_at, last_active_at, login_count, password_hash, password_changed_at, must_change_password, two_factor_enabled, two_factor_method, created_at, updated_at, deactivated_at, deactivated_by_id) FROM stdin;
recept001	org001	branch001	Khalid Al-Mansouri	خالد المنصوري	reception@moi.gov.sa	+966503456789	\N	receptionist	\N	Receptionist	t	f	\N	\N	2026-03-16 23:07:26.630188	\N	\N	\N	\N	0	7f516fb268b5c8db691156592ef8189a:90f551226b176cbd7cc88e8e4b8bb64cb8ba988245d6ec1f943366240ff118f0	\N	f	f	\N	2026-03-16 23:07:26.630188	2026-03-16 23:07:26.630188	\N	\N
host001	org001	branch001	Nora Al-Ghamdi	نورة الغامدي	employee@moi.gov.sa	+966504567890	\N	host_employee	Operations	Operations Manager	t	f	\N	\N	2026-03-16 23:07:30.489867	\N	\N	\N	\N	0	e3f44310a72686bec9dc3449b024f108:a05690d71cd319448e1eb73103602c7480cde6b4c6244dd3febaae4567fa6727	\N	f	f	\N	2026-03-16 23:07:30.489867	2026-03-16 23:07:30.489867	\N	\N
superadmin001	\N	\N	Mohammed Al-Qahtani	\N	admin@t2.sa	\N	\N	super_admin	\N	\N	t	f	\N	\N	\N	\N	\N	2026-03-16 23:10:01.03	2026-03-16 23:10:01.03	2	b278f10e0b72b05c4d2559d5d7f641eb:09dfd89c0bdaa09e9a3426cb1fc9430c53a52a055f109b51a5cd39dd246aab28	\N	f	f	\N	2026-03-16 23:07:07.112532	2026-03-16 23:07:07.112532	\N	\N
vm001	org001	branch001	Sara Al-Dosari	سارة الدوسري	vm@moi.gov.sa	+966502345678	\N	visitor_manager	Security	Visitor Manager	t	f	\N	\N	2026-03-16 23:07:22.70914	\N	\N	2026-03-16 23:10:05.252	2026-03-16 23:10:05.252	1	3cf9f30676f3cdb07a22685d62f43a6a:0f6fa376f55a8d0917c0ebce30b29407ce8bb967ad7af49850edcadcc03bca79	\N	f	f	\N	2026-03-16 23:07:22.70914	2026-03-16 23:07:22.70914	\N	\N
orgadmin001	org001	\N	Ahmed Al-Rashid	أحمد الراشد	admin@moi.gov.sa	+966501234567	\N	org_admin	Administration	IT Director	t	f	\N	\N	2026-03-16 23:07:18.811741	\N	\N	2026-03-17 00:07:19.704	2026-03-17 00:07:19.704	3	405c82f30b2e1f194d93bd66bf8b8f68:a848318ce4e87b64e50761664d9bd9eccb56766f76a9822d526ff69333f8b6ca	\N	f	f	\N	2026-03-16 23:07:18.811741	2026-03-16 23:07:18.811741	\N	\N
\.


--
-- Data for Name: visit_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.visit_requests (id, org_id, branch_id, visitor_id, host_user_id, purpose, purpose_ar, type, status, scheduled_date, scheduled_time_from, scheduled_time_to, qr_code, qr_expires_at, tracking_token, check_in_time, check_out_time, checked_in_by_id, approval_method, approved_by_id, approved_at, rejection_reason, notes, created_at, updated_at) FROM stdin;
req001	org001	branch001	visitor001	host001	Business meeting re: digital transformation project	\N	pre_registered	checked_in	2026-03-16	10:00	12:00	o6c_fWLCnqBRGpGlAnK-4dLf-5CHKiQW	2026-03-17 23:08:18.465819	e18a105417a1e2b11f5ecad7995db182	2026-03-16 22:08:18.465819	\N	\N	web	vm001	2026-03-16 21:08:18.465819	\N	\N	2026-03-16 20:08:18.465819	2026-03-16 23:08:18.465819
req002	org001	branch001	visitor002	host001	Annual review presentation	\N	pre_registered	approved	2026-03-16	14:00	16:00	pn6ts2kLsIn7OGaFLrlPOpOQwUzwT6LD	2026-03-17 23:08:18.465819	f32f9b0014258cb913ef932602d832d6	\N	\N	\N	web	vm001	2026-03-16 22:38:18.465819	\N	\N	2026-03-16 19:08:18.465819	2026-03-16 23:08:18.465819
req003	org001	branch001	visitor003	\N	Request for document verification	\N	walk_in	pending	2026-03-16	09:00	10:00	\N	\N	cca0dade7433d1333d21643a529693b2	\N	\N	\N	\N	\N	\N	\N	\N	2026-03-16 18:08:18.465819	2026-03-16 23:08:18.465819
req004	org001	branch002	visitor004	\N	Vendor contract renewal	\N	walk_in	pending	2026-03-17	11:00	13:00	\N	\N	dcc5551cf4ec698037076bbae6334469	\N	\N	\N	\N	\N	\N	\N	\N	2026-03-15 23:08:18.465819	2026-03-16 23:08:18.465819
req005	org001	branch001	visitor001	host001	Follow-up on security audit findings	\N	pre_registered	checked_out	2026-03-15	09:00	11:00	\N	\N	544757c02ea4fbf3b964ee627d413359	2026-03-14 23:08:18.465819	\N	\N	web	vm001	2026-03-14 23:08:18.465819	\N	\N	2026-03-14 23:08:18.465819	2026-03-16 23:08:18.465819
\.


--
-- Data for Name: visitors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.visitors (id, national_id_number, full_name, full_name_ar, phone, email, company_name, photo_url, is_blacklisted, blacklist_reason, verification_status, nafath_verified_at, nafath_transaction_id, nafath_confidence_level, otp_verified_at, otp_phone_used, last_verification_method, last_verified_at, created_at, updated_at) FROM stdin;
visitor001	1023456789	Abdullah Al-Otaibi	عبدالله العتيبي	+966511111111	aotaibi@gmail.com	Tech Solutions Co.	\N	f	\N	verified_otp	\N	\N	\N	\N	\N	\N	\N	2026-03-16 23:08:10.600707	2026-03-16 23:08:10.600707
visitor002	2034567890	Fatima Al-Zahrani	فاطمة الزهراني	+966522222222	fzahrani@company.sa	Global Trading Ltd	\N	f	\N	pending	\N	\N	\N	\N	\N	\N	\N	2026-03-16 23:08:10.600707	2026-03-16 23:08:10.600707
visitor003	3045678901	Omar Hassan	عمر حسن	+966533333333	ohassan@outlook.com	Hassan Group	\N	f	\N	verified_nafath	\N	\N	\N	\N	\N	\N	\N	2026-03-16 23:08:10.600707	2026-03-16 23:08:10.600707
visitor004	4056789012	Layla Al-Rashid	ليلى الراشد	+966544444444	\N	Al-Rashid Trading	\N	f	\N	pending	\N	\N	\N	\N	\N	\N	\N	2026-03-16 23:08:10.600707	2026-03-16 23:08:10.600707
visitor005	5067890123	Saad Al-Malki	سعد المالكي	+966555555555	smalki@gmail.com	\N	\N	t	\N	unverified	\N	\N	\N	\N	\N	\N	\N	2026-03-16 23:08:10.600707	2026-03-16 23:08:10.600707
\.


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: blacklist blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blacklist
    ADD CONSTRAINT blacklist_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_invitation_token_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_invitation_token_unique UNIQUE (invitation_token);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_public_booking_slug_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_public_booking_slug_unique UNIQUE (public_booking_slug);


--
-- Name: otp_sessions otp_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otp_sessions
    ADD CONSTRAINT otp_sessions_pkey PRIMARY KEY (id);


--
-- Name: telegram_subscriptions telegram_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telegram_subscriptions
    ADD CONSTRAINT telegram_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: visit_requests visit_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visit_requests
    ADD CONSTRAINT visit_requests_pkey PRIMARY KEY (id);


--
-- Name: visit_requests visit_requests_qr_code_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visit_requests
    ADD CONSTRAINT visit_requests_qr_code_unique UNIQUE (qr_code);


--
-- Name: visit_requests visit_requests_tracking_token_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visit_requests
    ADD CONSTRAINT visit_requests_tracking_token_unique UNIQUE (tracking_token);


--
-- Name: visitors visitors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.visitors
    ADD CONSTRAINT visitors_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict FtoDTfxZDQOn9dIQvqVPZOjG5EvdD0PGWnpJa53LNwyjs7fs0wrdvJ9WY4kagSF

