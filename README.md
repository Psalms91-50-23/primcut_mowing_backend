## Backend Overview

The Happy Lawns backend is built to support a service-based lawn care booking and quote management system. It handles customer enquiries, service selection, quote workflows, authentication, role-based access, and automated backend jobs.

The backend uses **Supabase** for authentication, database storage, and secure data access. Email confirmation is used during sign-up so users must verify their email address before accessing protected features.

### Key Backend Features

* User authentication with email confirmation
* Role-based access for owner, admin, employee, and customer workflows
* Service management for lawn care and related services
* Customer enquiry and quote request handling
* Quote status tracking and expiry handling
* Automated job to expire old quotes and stale drafts
* Backend validation to keep submitted data consistent
* Audit/change-log structure for tracking important updates
* Supabase database integration for persistent storage
* Environment variable configuration for secure API keys and service settings

### Automated Quote Expiry Job

The backend includes an automated job that checks for expired quotes and stale draft records. This helps keep the system clean and prevents outdated quotes from staying active.

Example job behaviour:

```txt
Auto-expire quotes job started
Expired quotes: 0
Stale drafts: 0
```

### Auditing and Change Logs

A change-log system was designed to track important updates made inside the platform. This helps improve accountability and makes it easier to review changes later.

The auditing system uses a `ChangeLog` model and a safe helper function such as `createChangeLogSafe()`. Some logging may be paused or limited during development to avoid creating unnecessary logs for every small edit.

### Backend Challenges

A key challenge was designing the backend as more than a simple form submission system. The project needed structured workflows for different user roles, reliable authentication, quote management, and automated backend logic.

Another challenge was balancing useful audit logging with performance and database cleanliness. Logging every small change can quickly create unnecessary data, so the system needed to be designed carefully.

The email confirmation workflow also required business email configuration, because sign-up confirmation emails depend on a working sender email address.
