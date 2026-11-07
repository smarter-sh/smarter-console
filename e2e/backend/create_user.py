"""
Creates the end-to-end tests' throwaway user, in an account of its own, in a Smarter backend.

Run by e2e/backend.ts, in the backend's container, with manage.py shell. It uses the backend's own test factory,
which creates the account, the user and their profile, and sends no email, then gives the user a random password.
It prints the user as one line, E2E_USER=<json>, which the tests read; e2e/backend/delete_user.py deletes it.
"""

import json
import secrets

from smarter.apps.account.tests.factories import mortal_user_factory

user, account, user_profile = mortal_user_factory()
password = secrets.token_urlsafe(24)
user.set_password(password)
user.save(update_fields=["password"])

print(
    "E2E_USER="
    + json.dumps(
        {
            "email": user.email,
            "password": password,
            "userId": user.pk,
            "accountId": account.pk,
            "userProfileId": user_profile.pk,
        }
    )
)
