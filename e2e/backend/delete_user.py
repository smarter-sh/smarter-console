"""
Deletes the end-to-end tests' throwaway user, their profile and their account, by the ids in the environment.

Run by e2e/backend.ts, in the backend's container, with manage.py shell. It deletes exactly these three rows, and
not, as the backend's factory_account_teardown() does, every test account: a test run of the backend may be using
those.
"""

import os

from smarter.apps.account.models import Account, User, UserProfile

UserProfile.objects.filter(pk=int(os.environ["E2E_USER_PROFILE_ID"])).delete()
User.objects.filter(pk=int(os.environ["E2E_USER_ID"])).delete()
Account.objects.filter(pk=int(os.environ["E2E_ACCOUNT_ID"])).delete()
print("E2E_DELETED")
