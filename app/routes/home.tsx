import type {Route} from "./+types/home";
import {Invoice} from "~/components/Invoice/Invoice";
import styles from "./home.module.css";
import {useEffect, useState} from "react";
import {Navbar} from "~/components/Navbar/Navbar";

export function meta({}: Route.MetaArgs) {
    return [
        {title: "Dacc, simple invoicing"},
        {name: "description", content: "Invoicing made simple with Dacc"},
    ];
}

export default function Home() {
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [created, setCreated] = useState("");
    const [due, setDue] = useState("");
    const [description, setDescription] = useState("");
    const [quantity, setQuantity] = useState(0);
    const [rate, setRate] = useState(0);
    const [showLogo, setShowLogo] = useState(true);

    const [company, setCompany] = useState({
        name: "Example Company",
        address: "1234 Main St",
        city: "Springfield",
        country: "USA",
        email: "example@example.com",
        postalCode: "12345"
    });
    const [paid, setPaid] = useState(false);

    const saveToLocalStorage = () => {
        localStorage.setItem("data", JSON.stringify({
            invoiceNumber, created, due, description,
            company,
            showLogo,
            quantity,
            rate
        }));
    }

    useEffect(() => {
        //save and load from local storage
        const data = localStorage.getItem("data");
        if (data) {
            const parsedData = JSON.parse(data);
            setInvoiceNumber(parsedData.invoiceNumber);
            setCreated(parsedData.created);
            setDue(parsedData.due);
            setDescription(parsedData.description);
            setCompany(parsedData.company);
            setShowLogo(parsedData.showLogo);
            setQuantity(parsedData.quantity);
            setRate(parsedData.rate);
        }
    }, []);

    return (
        <>
            <Navbar/>
            <br/>
            <div className={`${styles.controls} w-100 m-auto noPrint vstack`}>
                <details className="card p-0 no-shadow">
                    <summary>
                        <h4>Factura</h4>
                    </summary>

                    <div className="hstack f-wrap p-def">
                        <div className="f-column vstack f-grow">
                            <label>Factura #</label>
                            <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}/>
                        </div>
                        <div className="f-column vstack f-grow">
                            <label>Creada</label>
                            <input value={created} onChange={(e) => setCreated(e.target.value)}/>
                        </div>
                        <div className="f-column vstack f-grow">
                            <label>Fecha de vencimiento</label>
                            <input value={due} onChange={(e) => setDue(e.target.value)}/>
                        </div>
                        <div className="f-column vstack">
                            <label>Mostrar logo</label>
                            <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)}/>
                        </div>
                        <div className="f-column vstack">
                            <label>Pagada</label>
                            <input type="checkbox" onChange={(e) => setPaid(e.target.checked)}/>
                        </div>
                    </div>

                    <div className="f-column vstack p-def">
                        <label>Descripcion</label>
                        <input value={description} onChange={(e) => setDescription(e.target.value)}/>
                    </div>
                    <div className="hstack f-wrap p-def">
                        <div className="f-column vstack f-grow">
                            <label>Cantidad</label>
                            <input type="number" value={quantity}
                                   onChange={(e) => setQuantity(parseInt(e.target.value))}/>
                        </div>
                        <div className="f-column vstack f-grow">
                            <label>Rate</label>
                            <input value={rate} type="number" onChange={(e) => setRate(parseInt(e.target.value))}/>
                        </div>
                    </div>

                </details>

                <details className="card p-0 no-shadow">
                    <summary>
                        <h4>Compañía</h4>
                    </summary>
                    <div className="hstack f-wrap p-def">
                        <div className="f-column vstack f-grow">
                            <label>Nombre</label>
                            <input value={company?.name}
                                   onChange={(e) => setCompany({...company, name: e.target.value})}/>
                        </div>
                        <div className="f-column vstack f-grow">
                            <label>Dirección</label>
                            <input value={company?.address}
                                   onChange={(e) => setCompany({...company, address: e.target.value})}/>
                        </div>
                        <div className="f-column vstack f-grow">
                            <label>Ciudad</label>
                            <input value={company?.city}
                                   onChange={(e) => setCompany({...company, city: e.target.value})}/>
                        </div>
                        <div className="f-column vstack f-grow">
                            <label>País</label>
                            <input value={company?.country}
                                   onChange={(e) => setCompany({...company, country: e.target.value})}/>
                        </div>
                        <div className="f-column vstack f-grow">
                            <label>Email</label>
                            <input value={company?.email}
                                   onChange={(e) => setCompany({...company, email: e.target.value})}/>
                        </div>
                        <div className="f-column vstack f-grow">
                            <label>Código postal</label>
                            <input value={company?.postalCode}
                                   onChange={(e) => setCompany({...company, postalCode: e.target.value})}/>
                        </div>
                    </div>
                </details>

                <div>
                    <button
                        id="printButton"
                        onClick={() => {
                            saveToLocalStorage();
                            window.print();
                        }}
                    >
                        Print invoice
                    </button>
                </div>
            </div>

            <br/>
            <br/>

            <Invoice
                invoiceNumber={invoiceNumber}
                created={created}
                due={due}
                items={[
                    {
                        description,
                        quantity,
                        rate
                    }
                ]}
                showLogo={showLogo}
                company={company}
                paid={paid}
            />

            <br/>
            <br/>
        </>
    );
}
