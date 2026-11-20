import {useId} from "react";
import {useLang} from "~/hooks/useLang";

interface CompanyFormProps {
    title: string;
    company: Company;
    setCompany: (newCompany: Company) => void;
}

export default function CompanyForm({company, setCompany, title}: CompanyFormProps) {
    const {t} = useLang();
    const id = useId();
    return (
        <details className="card p-0 no-shadow">
            <summary>
                <h4>{title || t("Company")}</h4>
            </summary>
            <div className="hstack f-wrap p-def">
                <div className="f-column vstack f-grow">
                    <label htmlFor={`${id}-name`}>{t("Name")}</label>
                    <input id={`${id}-name`} value={company?.name}
                           onChange={(e) => setCompany({...company, name: e.target.value})}/>
                </div>
                <div className="f-column vstack f-grow">
                    <label htmlFor={`${id}-address`}>{t("Address")}</label>
                    <input id={`${id}-address`} value={company?.address}
                           onChange={(e) => setCompany({...company, address: e.target.value})}/>
                </div>
                <div className="f-column vstack f-grow">
                    <label htmlFor={`${id}-city`}>{t("City")}</label>
                    <input id={`${id}-city`} value={company?.city}
                           onChange={(e) => setCompany({...company, city: e.target.value})}/>
                </div>
                <div className="f-column vstack f-grow">
                    <label htmlFor={`${id}-country`}>{t("Country")}</label>
                    <input id={`${id}-country`} value={company?.country}
                           onChange={(e) => setCompany({...company, country: e.target.value})}/>
                </div>
                <div className="f-column vstack f-grow">
                    <label htmlFor={`${id}-email`}>{t("Email")}</label>
                    <input id={`${id}-email`} value={company?.email}
                           onChange={(e) => setCompany({...company, email: e.target.value})}/>
                </div>
                <div className="f-column vstack f-grow">
                    <label htmlFor={`${id}-postalCode`}>{t("Postal code")}</label>
                    <input id={`${id}-postalCode`} value={company?.postalCode}
                           onChange={(e) => setCompany({...company, postalCode: e.target.value})}/>
                </div>
            </div>
        </details>
    );
}
