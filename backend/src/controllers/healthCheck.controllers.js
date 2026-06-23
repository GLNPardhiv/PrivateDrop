import { APIResponse }  from "../utils/apiResponse.js";

const healthCheck = (req, res) => {
    return res.status(200)
        .json(
            new APIResponse(
                200,
                null,
                "Server is running"
            )
        );
};

export { healthCheck };