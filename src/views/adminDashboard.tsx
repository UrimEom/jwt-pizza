import React from 'react';
import View from './view';
import { useNavigate } from 'react-router-dom';
import NotFound from './notFound';
import Button from '../components/button';
import { pizzaService } from '../service/service';
import {
   Franchise,
   FranchiseList,
   Role,
   Store,
   User,
   UserList,
} from '../service/pizzaService';
import { TrashIcon } from '../icons';

interface Props {
  user: User | null;
}

export default function AdminDashboard(props: Props) {
  const navigate = useNavigate();
  const [franchiseList, setFranchiseList] = React.useState<FranchiseList>({ franchises: [], more: false });
  const [franchisePage, setFranchisePage] = React.useState(0);
  const filterFranchiseRef = React.useRef<HTMLInputElement>(null);
  const [userList, setUserList] = React.useState<UserList>({
    users: [],
    more: false,
  });
 
  const [userError, setUserError] = React.useState('');

  const [userPage, setUserPage] = React.useState(1);
  const [userFilter, setUserFilter] = React.useState('*');
  const [userFilterInput, setUserFilterInput] = React.useState('');
  const [usersLoading, setUsersLoading] = React.useState(true);
 
   React.useEffect(() => {
    if (!Role.isRole(props.user, Role.Admin)) {
      return;
    }

    let active = true;

    async function loadUsers() {
      setUsersLoading(true);
      setUserError('');

      try {
        const result = await pizzaService.getUsers(
          userPage,
          10,
          userFilter
        );
 
        if (active) {
          setUserList(result);
        }
      } catch {
        if (active) {
          setUserError('Unable to load users.');
        }
      } finally {
        if (active) {
          setUsersLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      active = false;
    };
  }, [props.user, userPage, userFilter]);

  React.useEffect(() => {
    (async () => {
      setFranchiseList(await pizzaService.getFranchises(franchisePage, 3, '*'));
    })();
  }, [props.user, franchisePage]);

  function createFranchise() {
    navigate('/admin-dashboard/create-franchise');
  }

  async function closeFranchise(franchise: Franchise) {
    navigate('/admin-dashboard/close-franchise', { state: { franchise: franchise } });
  }

  async function closeStore(franchise: Franchise, store: Store) {
    navigate('/admin-dashboard/close-store', { state: { franchise: franchise, store: store } });
  }

  async function filterFranchises() {
    setFranchiseList(await pizzaService.getFranchises(franchisePage, 10, `*${filterFranchiseRef.current?.value}*`));
  }

   function filterUsers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
 
    setUserPage(1);
    setUserFilter(`*${userFilterInput.trim()}*`);
  }

  let response = <NotFound />;
  if (Role.isRole(props.user, Role.Admin)) {
    response = (
      <View title="Mama Ricci's kitchen">
        <div className="text-start py-8 px-4 sm:px-6 lg:px-8">
          <h3 className="text-neutral-100 text-xl">Franchises</h3>
          <div className="bg-neutral-100 overflow-clip my-4">
            <div className="flex flex-col">
              <div className="-m-1.5 overflow-x-auto">
                <div className="p-1.5 min-w-full inline-block align-middle">
                  <div className="overflow-hidden">
                      <table
                        aria-label="Franchises"
                        className="min-w-full divide-y divide-gray-200"
                        >
                      <thead className="uppercase text-neutral-100 bg-slate-400 border-b-2 border-gray-500">
                        <tr>
                          {['Franchise', 'Franchisee', 'Store', 'Revenue', 'Action'].map((header) => (
                            <th key={header} scope="col" className="px-6 py-3 text-center text-xs font-medium">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      {franchiseList.franchises.map((franchise, findex) => {
                        return (
                          <tbody key={findex} className="divide-y divide-gray-200">
                            <tr className="border-neutral-500 border-t-2">
                              <td className="text-start px-2 whitespace-nowrap text-l font-mono text-orange-600">{franchise.name}</td>
                              <td className="text-start px-2 whitespace-nowrap text-sm font-normal text-gray-800" colSpan={3}>
                                {franchise.admins?.map((o) => o.name).join(', ')}
                              </td>
                              <td className="px-6 py-1 whitespace-nowrap text-end text-sm font-medium">
                                <button type="button" className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-1 border-orange-400 text-orange-400  hover:border-orange-800 hover:text-orange-800" onClick={() => closeFranchise(franchise)}>
                                  <TrashIcon />
                                  Close
                                </button>
                              </td>
                            </tr>

                            {franchise.stores.map((store, sindex) => {
                              return (
                                <tr key={sindex} className="bg-neutral-100">
                                  <td className="text-end px-2 whitespace-nowrap text-sm text-gray-800" colSpan={3}>
                                    {store.name}
                                  </td>
                                  <td className="text-end px-2 whitespace-nowrap text-sm text-gray-800">{store.totalRevenue?.toLocaleString()} ₿</td>
                                  <td className="px-6 py-1 whitespace-nowrap text-end text-sm font-medium">
                                    <button type="button" className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-1 border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800" onClick={() => closeStore(franchise, store)}>
                                      <TrashIcon />
                                      Close
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        );
                      })}
                      <tfoot>
                        <tr>
                          <td className="px-1 py-1">
                            <input type="text" ref={filterFranchiseRef} name="filterFranchise" placeholder="Filter franchises" className="px-2 py-1 text-sm border border-gray-300 rounded-lg" />
                            <button type="submit" className="ml-2 px-2 py-1 text-sm font-semibold rounded-lg border border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800" onClick={filterFranchises}>
                              Submit
                            </button>
                          </td>
                          <td colSpan={4} className="text-end text-sm font-medium">
                            <button className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300 " onClick={() => setFranchisePage(franchisePage - 1)} disabled={franchisePage <= 0}>
                              «
                            </button>
                            <button className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300" onClick={() => setFranchisePage(franchisePage + 1)} disabled={!franchiseList.more}>
                              »
                            </button>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <Button className="w-36 text-xs sm:text-sm sm:w-64" title="Add Franchise" onPress={createFranchise} />
        </div>
        <section className="text-start py-8 px-4 sm:px-6 lg:px-8">
         <h3 className="text-neutral-100 text-xl">Users</h3>

         <form
            onSubmit={filterUsers}
            className="flex flex-wrap items-center gap-2 my-4"
         >
            <label htmlFor="filter-users" className="text-neutral-100">
               Filter users
            </label>

            <input
               id="filter-users"
               type="text"
               value={userFilterInput}
               onChange={(event) => setUserFilterInput(event.target.value)}
               placeholder="Enter a user name"
               className="px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
            />

            <button
               type="submit"
               disabled={usersLoading}
               className="px-3 py-2 rounded-lg border border-orange-400 text-orange-400 disabled:opacity-50"
            >
               Filter users
            </button>
         </form>

         {userError && (
            <p role="alert" className="my-2 text-red-400">
               {userError}
            </p>
         )}

         {usersLoading && (
            <p role="status" className="my-2 text-neutral-100">
               Loading users...
            </p>
         )}

         <div className="bg-neutral-100 overflow-x-auto my-4">
            <table
               aria-label="Users"
               className="min-w-full divide-y divide-gray-200"
            >
               <thead className="uppercase text-neutral-100 bg-slate-400">
               <tr>
                  {['Name', 'Email', 'Roles'].map((heading) => (
                     <th
                     key={heading}
                     scope="col"
                     className="px-6 py-3 text-start text-sm font-medium"
                     >
                     {heading}
                     </th>
                  ))}
               </tr>
               </thead>

               <tbody className="divide-y divide-gray-200">
               {userList.users.map((listedUser) => (
                  <tr key={listedUser.id} className="text-gray-800">
                     <td className="px-6 py-4 text-sm">
                     {listedUser.name}
                     </td>

                     <td className="px-6 py-4 text-sm">
                     {listedUser.email}
                     </td>

                     <td className="px-6 py-4 text-sm">
                     {listedUser.roles?.map((role) => role.role).join(', ')}
                     </td>
                  </tr>
               ))}

               {!usersLoading && !userError && userList.users.length === 0 && (
                  <tr>
                     <td colSpan={3} className="px-6 py-4 text-gray-800">
                     No users found.
                     </td>
                  </tr>
               )}
               </tbody>
            </table>
         </div>

         <div className="flex items-center justify-end gap-3 text-neutral-100">
            <button
               type="button"
               disabled={usersLoading || userPage <= 1}
               onClick={() => setUserPage((page) => page - 1)}
               className="px-3 py-2 rounded-lg border border-orange-400 text-orange-400 disabled:opacity-50"
            >
               Previous users
            </button>

            <span>Page {userPage}</span>

            <button
               type="button"
               disabled={usersLoading || !userList.more}
               onClick={() => setUserPage((page) => page + 1)}
               className="px-3 py-2 rounded-lg border border-orange-400 text-orange-400 disabled:opacity-50"
            >
               Next users
            </button>
         </div>
        </section>
      </View>
    );
  }

  return response;
}
