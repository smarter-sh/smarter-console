"""
Deletes the end-to-end tests' throwaway user, their profile and their account, by the ids in the environment.

Run by e2e/backend.ts, in the backend's container, with manage.py shell. It deletes exactly these rows, and not, as
the backend's factory_account_teardown() does, every test account: a test run of the backend may be using those.
It also deletes the account's admin user, <account number>-admin, which the backend creates for an account that has
none, e.g. when the dashboard lists the user's resources: deleting the account deletes its profile, not its user.
"""

import os

from smarter.apps.account.models import Account, User, UserProfile

account = Account.objects.filter(pk=int(os.environ["E2E_ACCOUNT_ID"])).first()
UserProfile.objects.filter(pk=int(os.environ["E2E_USER_PROFILE_ID"])).delete()
User.objects.filter(pk=int(os.environ["E2E_USER_ID"])).delete()
if account is not None:
    User.objects.filter(username=f"{account.account_number}-admin").delete()
    account.delete()
print("E2E_DELETED")
